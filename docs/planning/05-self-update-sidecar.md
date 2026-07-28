# Self-Update via One-Shot Updater Container

**Status:** Requirements / Planning
**Priority:** High (current self-update is broken — see problem statement)
**Depends on:** `04-security-hardening.md` R5 (admin role gates this endpoint)

---

## 1. Problem statement

`POST /api/containers/:id/update` has two paths:

- **Other containers** → `pullImageAndRecreateIfNeeded()` runs in the backend process. This works: the backend survives the whole pull → stop → rename → create → start → cleanup sequence.
- **Self** (the container hosting the backend) → `pullImageAndRecreateDetached()` spawns `restart-container.js` with `spawn(..., { detached: true })`. This **cannot work**: the detached process still lives *inside the container being restarted*. The moment the script stops its own container, Docker kills every process in it — including the script — so the rename/create/start steps never run. Because an explicit API stop disables the restart policy, the container stays down until someone intervenes manually. Additionally the script's config file is written to the container's own tmpdir, which would be unreachable for any external process anyway.

## 2. Scope decision: updater is used **only** for self-update

The one-shot updater container is spawned **exclusively** when the update target is the app's own container (`isSelfContainer() === true`).

Rationale:
- For every other container the existing in-process path is simpler, already works, keeps error reporting synchronous (the HTTP response contains the outcome), and involves no extra moving parts.
- The updater exists solely to solve the "can't outlive the thing I'm restarting" problem, which only affects self-update.
- Unifying both paths through the updater is a possible future refactor (single code path), but is explicitly **out of scope** here.

## 3. Functional requirements

### R1 — Pull happens in-process, before any restart (MUST)
- On self-update the backend itself pulls the image (it is still alive at this point) and compares old vs new image ID — same logic as `pullImageAndRecreateIfNeeded`.
- If the pull fails → respond with the error; nothing is stopped.
- If the image is unchanged → respond "already up to date"; **no updater is started, no restart happens** (today the detached path restarts unconditionally).
- Only when a new image ID exists does the backend create the updater and return a "restart scheduled" response.

### R2 — Updater is a one-shot container, not a process (MUST)
- Created via the Docker Engine API (no docker CLI dependency).
- **Image:** the freshly pulled app image itself — guaranteed present after R1, correct architecture, contains Node and `backend/scripts/restart-container.js`. No extra image to maintain.
- **Command:** `node /app/backend/scripts/restart-container.js` with parameters passed via **env vars / CMD args** (target container id, container name, image ref, wait seconds) — *not* a tmp file. The updater re-`inspect`s the target itself to get a fresh config snapshot.
- **HostConfig:** binds `/var/run/docker.sock` (same path as the app uses); no published ports; `RestartPolicy: no`.
- **Labels:** `kma-rma.role=updater`, `kma-rma.target=<containerName>` — used for locking, status and cleanup.
- Runs under the default network; it only talks to the Docker socket.

### R3 — Update sequence executed by the updater (MUST)
1. Wait ~3 s (lets the backend flush its HTTP response and SSE notice).
2. Stop target (`t=10`).
3. Rename target to `<name>-old-<ts>`.
4. Create new container named `<name>` from the new image, config recreated from the fresh inspect (env, mounts, ports, network aliases, restart policy — same rules as `createContainerFromInspect`).
5. Start new container.
6. Verify: new container still `Running` after N seconds (default 10; use image `HEALTHCHECK` state if present).
7. Remove the old container.
8. Exit 0.

### R4 — Rollback (MUST)
- Any failure in steps 4–6: remove the partially created container (force), rename the old container back to `<name>`, start it, exit 1.
- Rollback failure is logged loudly (`CRITICAL`) — the log must survive (see R6).

### R5 — Concurrency guard (MUST)
- Before creating an updater, the backend checks for an existing container labelled `kma-rma.role=updater` in state `created`/`running` → respond `409 Conflict`. Prevents double-click double updates.

### R6 — Observability (MUST)
- Updater logs every step to stdout (visible via `docker logs`).
- **`AutoRemove` is NOT used.** On success the updater removes *itself* via the API as its last step; on failure it stays (exited, non-zero) so its logs can be inspected. The backend removes stale exited updaters on startup (by label, older than 24 h).
- New endpoint `GET /api/self-update/status` (admin): reports updater container state + last log lines, letting the UI show progress after reconnect.
- Before scheduling, the backend broadcasts an SSE event (e.g. `self_update: scheduled`) so the UI can show a "Restarting, reconnecting…" banner. The existing `EventSource` auto-reconnect covers the comeback; expected downtime is seconds (pull already done in R1).

### R7 — Security (MUST)
- Endpoint restricted to the `admin` role (doc 04, R5) and CSRF-protected (doc 04, R6).
- UI requires explicit confirmation before triggering self-update.

### R8 — Compatibility (MUST)
- Works on arm64 (Raspberry Pi) and amd64; no new runtime dependencies in the image.
- `restart-container.js` is adapted (params from env/args + self-remove + no-AutoRemove semantics) rather than rewritten; the in-container `spawn` path (`pullImageAndRecreateDetached`) is **removed**.

## 4. Edge cases

| Case | Expected behavior |
|------|-------------------|
| Pull fails / registry unreachable | HTTP error response, no restart, no updater |
| Image unchanged | "Up to date" response, no updater |
| Updater creation fails | HTTP error response, app keeps running untouched |
| New container crashes on boot | Rollback to old container; updater left exited(1) with logs; status endpoint shows failure |
| Rollback also fails | Updater exits 1, logs `CRITICAL`; container down — this is the residual risk window, kept as small as possible (old container still exists under `<name>-old-<ts>` for manual `docker start`) |
| Two updates triggered quickly | Second gets `409` (R5) |
| Backend killed before updater starts working | Fine — updater is independent; it stops whatever is running and proceeds |

## 5. Acceptance criteria

- [ ] Triggering self-update on a RPi deployment with a newer image available results in the app coming back on the new image ID within ~30 s, with the page reconnecting automatically (no manual refresh needed).
- [ ] Triggering with no newer image performs no restart.
- [ ] Killing the new container's entrypoint (simulated bad image) results in automatic rollback to the previous image, and `GET /api/self-update/status` reports the failure.
- [ ] `docker ps -a` shows no leftover updater containers after a successful update.
- [ ] Non-admin token receives 403; concurrent trigger receives 409.
- [ ] Other-container updates behave exactly as before (in-process path untouched).

## 6. Open questions

1. Should the app image define a `HEALTHCHECK` (HTTP GET `/api/health`) so R3.6 can use Docker's health state instead of "still running after N seconds"? (Recommended: yes, small Dockerfile addition.)
2. Is a maintenance page / countdown in the UI worth it, or is the reconnect banner enough for a 1–2 user app? (Assumed: banner is enough.)
