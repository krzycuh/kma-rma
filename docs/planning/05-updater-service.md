# Container Updates via a Dedicated Updater Service (`container-manager`)

**Status:** Implemented (v3). Decisions on the open questions: Q1 — yes, `HEALTHCHECK` added to both Dockerfiles; Q2 — explicit allowlist (`ALLOWED_CONTAINERS`); Q3 — the read proxy and the updater are merged into a **single service named `container-manager`** instead of a separate `docker-socket-proxy`, so there is one privileged sidecar with one shared secret. Its read path is a GET-only path allowlist (`/containers/json`, `/containers/{id}/json`, `/containers/{id}/stats`, `/containers/{id}/logs` — streamed for `follow`), which supersedes R6's `docker-socket-proxy` wording below.
**Priority:** High (previous self-update was broken — see problem statement)
**Related:** `04-security-hardening.md` (this design implements R10 for the mutation path)

---

## 1. Problem statement

`POST /api/containers/:id/update` has two paths today:

- **Other containers** → `pullImageAndRecreateIfNeeded()` runs in the backend process and works.
- **Self** → `pullImageAndRecreateDetached()` spawns `restart-container.js` *inside the container being restarted*. When the script stops its own container, Docker kills every process in it — including the script — so the create/start steps never run, and an explicit API stop disables the restart policy. **The app goes down and stays down.** The tmp-file config handoff is also unreachable from outside the container.

Independently, `04-security-hardening.md` (W6, R10) flags that mounting the raw `/var/run/docker.sock` into the internet-exposed dashboard makes any token compromise equivalent to root on the host.

## 2. Decision record

| Option | Description | Verdict |
|--------|-------------|---------|
| A. One-shot sidecar (v1 of this doc) | Dashboard keeps docker.sock; on self-update it spawns a temporary updater container | Fixes self-update only; dashboard keeps full root-equivalent socket access; two update code paths |
| **B. Dedicated updater service (CHOSEN)** | Small, always-running container owns docker.sock and exposes a narrow internal API: "update container *name*". Dashboard has **no** direct mutation access | Fixes self-update **and** unifies all updates into one path **and** removes root-equivalent power from the dashboard |
| C. Watchtower (HTTP API mode) | Off-the-shelf updater triggered via its token-protected HTTP API | Least code to own, battle-tested; but coarse per-call feedback (no per-container result/rollback status for the UI). Kept as fallback if B turns out too costly |

**Why B:** one mechanism for every container (kma-rma included — from the updater's point of view kma-rma is just another name), a real security boundary (the dashboard token no longer guards the whole host), and the existing, already-written `restart-container.js` logic (pull → stop → rename → create → start → verify → rollback) moves there almost unchanged.

**Consequence for the read path (important):** stats, container list and log streaming still need Docker API reads. If the dashboard keeps the raw socket for reads, the security gain is **zero** — the socket does not distinguish read intent from write capability (a `:ro` mount does *not* make the API read-only). Therefore reads MUST also be taken off the raw socket (R6 below).

## 3. Architecture

```
                    internet
                       │ HTTPS (proxy/tunnel)
                ┌──────▼──────┐
                │   kma-rma   │  no docker.sock
                │  dashboard  │
                └──────┬──────┘
                       │ internal network, shared secret
            ┌──────────▼──────────┐
            │  container-manager  │  GET-only proxy (list/stats/logs)
            │     docker.sock     │  + POST /update, GET /status/:id
            └─────────────────────┘
```

The single privileged service lives on an internal Docker network, publishes **no host ports**, and is unreachable from outside the host. (Q3 decision: proxy + updater merged into one service — one sidecar, one secret, one endpoint for the dashboard.)

## 4. Functional requirements — updater service

### R1 — API surface (MUST)
- `POST /update` body: `{ "container": "<name>", "requestId": "<uuid>" }` — the **only** mutating operation. The image reference is taken from the running container's config; the caller can NOT specify an image, command, mounts or any other property. This keeps the API "re-pull & recreate", not "run anything".
- `GET /status/:requestId` — state machine of an update: `pulling | up-to-date | restarting | verifying | done | rolled-back | failed`, plus step logs. Survives the target's restart because the updater itself never restarts during an update.
- `GET /health` — liveness.

### R2 — Authorization of callers (MUST)
- Shared static secret (env `UPDATER_TOKEN` on both sides), sent as a header; constant-time comparison. No secret → 401.
- Allowlist of manageable container names (env `UPDATER_ALLOWED_CONTAINERS`, comma-separated). Requests for other names → 403. A compromised dashboard can then at worst re-pull/restart the listed containers.
- Listens only on the internal Docker network (no published ports).

### R3 — Update sequence (MUST)
1. Inspect target, pull its image ref. Pull failure → `failed`, nothing stopped.
2. Compare image IDs; unchanged → `up-to-date`, no restart (unconditional-restart behavior of the old detached path is dropped).
3. Stop (`t=10`) → rename to `<name>-old-<ts>` → create new `<name>` from fresh inspect (env, mounts, ports, networks, restart policy) → start.
4. Verify: `Running` after N s (use image `HEALTHCHECK` if present; recommended to add one to kma-rma's Dockerfile hitting `/api/health`).
5. Success → remove old container, state `done`.
6. Any failure in 3–4 → remove partial new container, rename old back, start it, state `rolled-back` (or `failed` + `CRITICAL` log if rollback also fails; old container remains as `<name>-old-<ts>` for manual recovery).

### R4 — Concurrency & idempotency (MUST)
- One update at a time per container name; concurrent request → `409`.
- Global limit of parallel updates: 1 (RPi-friendly, and prevents a self-update racing another update). Queue or reject — reject is fine.

### R5 — Self-update of kma-rma "out of the box" (MUST)
- kma-rma calls `POST /update {container: "kma-rma"}` like for any other container. The HTTP response to the *user* is sent before the updater stops kma-rma (updater delays ~3 s; the SSE drop is handled by `EventSource` auto-reconnect). After reconnect the UI polls `GET /status/:requestId` **through kma-rma** to show the outcome.
- kma-rma's own `imageManager.ts` mutation code and `pullImageAndRecreateDetached` are **removed**; `restart-container.js` logic moves into the updater service.

### R6 — Dashboard read path without raw socket (MUST) — *implemented inside container-manager (Q3)*
- kma-rma's Docker reads (`/containers/json`, `/containers/{id}/stats`, `/containers/{id}/logs`) go through container-manager's GET-only path allowlist; log streams are piped, never buffered.
- `backend/src/docker/client.ts` gains TCP support (`CONTAINER_MANAGER_URL=http://container-manager:3002` + token header) next to the current `socketPath` mode (dev fallback; updates are disabled in fallback mode).
- After this, the kma-rma container mounts **no docker.sock at all**.

### R7 — Updater implementation constraints (SHOULD)
- Minimal Node service (same stack as the repo, reuses `restart-container.js` + `imageManager` logic), alpine-based, tens of MB RAM, arm64 + amd64.
- Lives in this monorepo (`updater/` package) and is built/published by the existing CI alongside the app image.
- Logs every step to stdout (`docker logs updater`).

### R8 — Updating the updater itself (MUST, documented limitation)
- The updater does NOT update itself (same self-restart trap this design removes from kma-rma). It changes rarely; update procedure is `docker compose pull updater && docker compose up -d updater` over SSH, documented in README. (COULD: allowlist the updater in a second updater or Watchtower later — explicitly out of scope now.)

### R9 — Compose / deployment (MUST) — *single service (Q3)*
- `docker-compose.yml` gains one `container-manager` service (socket mount, `MANAGER_TOKEN`, `ALLOWED_CONTAINERS`, internal network, no published ports); kma-rma loses its socket mount and gains `CONTAINER_MANAGER_URL` + `CONTAINER_MANAGER_TOKEN`.

## 5. What this changes for the threat model

- Dashboard token compromise now yields: metrics/logs read (via read-only proxy) + restart/re-pull of allowlisted containers. **Not** host root. (Container logs may still contain secrets — the dashboard token remains worth protecting; doc 04 stays fully relevant.)
- The updater becomes the crown jewel: mitigated by no published ports, internal network, narrow name-only API, allowlist, shared secret.
- Fulfills doc 04 R10 for the mutation path; the read path is narrowed to GET-only endpoints.

## 6. Edge cases

| Case | Expected behavior |
|------|-------------------|
| Pull fails / registry unreachable | `failed` status, target untouched |
| Image unchanged | `up-to-date`, no restart |
| Updater down when dashboard calls it | kma-rma returns 503 "updater unavailable"; hint shown in UI |
| New container won't start / unhealthy | Automatic rollback, status `rolled-back`, logs retained |
| Rollback fails | `failed` + `CRITICAL`; old container preserved under `<name>-old-<ts>` |
| Concurrent updates | 409 (R4) |
| kma-rma killed mid self-update | Irrelevant — updater is independent and finishes the job; status available after reconnect |

## 7. Acceptance criteria

- [ ] kma-rma container runs with **no** `/var/run/docker.sock` mount (verified in compose).
- [ ] Self-update from the UI on an RPi: app returns on the new image within ~30 s, page reconnects automatically, status shows `done`.
- [ ] Updating another allowlisted container works through the same endpoint; result visible via status polling.
- [ ] Update request for a non-allowlisted name → 403; wrong/missing updater token → 401; concurrent → 409.
- [ ] Simulated broken image → automatic rollback, status `rolled-back`, old app keeps serving.
- [ ] Stats, container list and log streaming still work via the read-only proxy; `POST` through the proxy is rejected (verified manually).
- [ ] `docker ps -a` clean after successful updates (no leftover `-old-` containers).

## 8. Open questions — resolved

1. `HEALTHCHECK` in kma-rma's Dockerfile → **yes, added** (`wget -qO- http://127.0.0.1:3001/api/health`; `/api/health` is exempt from token auth for this purpose). container-manager has its own `HEALTHCHECK` on `/health`.
2. Allowlist wildcard → **no, explicit list** (`ALLOWED_CONTAINERS=kma-rma,...`).
3. Separate `docker-socket-proxy` vs merged → **merged into the single `container-manager` service**, which proxies the read paths itself (streaming supported), so no third-party proxy image is needed.
