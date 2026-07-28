# Security Hardening: Authentication & Access Control

**Status:** Requirements / Planning
**Priority:** High
**Context:** The application is exposed **outside the LAN** (accessed from a phone over the internet). The container has access to `/var/run/docker.sock`, so a compromised credential is equivalent to **root on the Raspberry Pi** (an attacker can start a privileged container, mount the host filesystem, etc.). The auth mechanism is therefore guarding host-level access, not just a dashboard.

---

## 1. Weaknesses of the current solution

| # | Weakness | Details | Severity |
|---|----------|---------|----------|
| W1 | Token travels in the URL (`?token=...`) | Leaks into browser history, proxy/access logs, screenshots, copied/shared links and potentially `Referer` headers. Every API call and the SSE stream repeat it. It is also persisted in `localStorage` (PWA convenience), which is readable by any JS running on the origin. | High |
| W2 | Tokens are static, forever-valid | No expiry, no rotation, no per-device revocation. Removing a token requires editing `TOKENS` env and restarting the container. Tokens sit in plaintext in the env (visible via `docker inspect` to anything that can read the socket). | High |
| W3 | No brute-force protection | `validateToken()` is called on every request with no rate limiting, no lockout, no delay and no audit trail. A short/guessable token can be brute-forced from the internet. Lookup is also not constant-time (minor). | High |
| W4 | Transport security not enforced | The app itself serves plain HTTP. If it is port-forwarded directly (no TLS-terminating proxy/tunnel), tokens and data cross the internet in cleartext. Nothing in the app requires or signals HTTPS (no HSTS, no `Secure` cookie concept). | Critical if exposed without TLS |
| W5 | No authorization levels | Every token holder can do everything, including `POST /api/containers/:id/update` (pull + recreate arbitrary containers) and reading logs of every container. | Medium |
| W6 | Huge blast radius behind a single secret | Docker socket access means token compromise = full host takeover. There is no second factor, no confirmation step, no separation between "view metrics" and "mutate containers". | High |
| W7 | No audit logging | Failed/successful logins, IPs and mutating actions (container updates) are not logged, so an attack or misuse is undetectable. | Medium |
| W8 | No security headers | No `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`. | Low |
| W9 | CSRF not considered | Today token-in-URL incidentally prevents CSRF (the attacker doesn't know the token). The moment auth moves to cookies (see R1), state-changing endpoints become CSRF-able unless explicitly protected. | Must be handled together with R1 |

---

## 2. Requirements

Format: MUST / SHOULD / COULD. "Session" below means a server-verifiable, expiring credential — not the raw token.

### R1 — Cookie-based session login (MUST)
- `POST /api/auth/login` with the token in the **request body** (never URL). On success the server sets a session cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
- Session payload (user name, role, issued-at, expiry) is HMAC-signed with a `SESSION_SECRET` env var (min 32 random bytes) — stateless, no DB required.
- Session TTL: 30 days, rolling (refreshed on activity). `POST /api/auth/logout` clears the cookie.
- `GET /api/auth/me` returns the current user (replaces `GET /api/user?token=`).
- A session is only valid if the token it was created from **still exists** in `TOKENS` (store a token fingerprint, e.g. first 8 chars of SHA-256, in the session and re-check on every request). Removing a token from env + restart therefore revokes its sessions.

### R2 — Remove the token from URLs and storage (MUST)
- No endpoint accepts `?token=` after migration (one release MAY keep it for transition, logging a deprecation warning).
- Frontend: `fetch` and `EventSource` rely on the cookie (both send cookies automatically for same-origin requests). Remove the `localStorage` token persistence — the cookie replaces it and also fixes the PWA start-from-home-screen flow.
- The login page keeps the "paste token" UX; a `?token=` link MAY still be honored **once**: immediately exchanged for a session cookie and stripped from the URL via `history.replaceState`.

### R3 — Brute-force protection (MUST)
- Rate-limit `POST /api/auth/login` per IP **and** per presented token: e.g. 10 failures → 15-minute block (in-memory is fine, mirroring `class-evaluation`'s `LoginAttemptService`).
- Constant-time comparison of tokens (`crypto.timingSafeEqual` over hashes).
- Uniform error message and timing for "unknown token" vs "blocked".

### R4 — Token quality (MUST)
- Documented requirement: tokens ≥ 32 chars of cryptographic randomness (`openssl rand -base64 24`), one token per person/device.
- README documents generation and rotation procedure.
- SHOULD: support `TOKENS_SHA256` variant (env stores hashes, not plaintext) so `docker inspect` doesn't reveal usable secrets.

### R5 — Roles / authorization (MUST)
- Extend the `TOKENS` format with a role: `token->name->role` where role ∈ {`viewer`, `admin`} (missing role defaults to `viewer`).
- `viewer`: metrics, router data, SSE stream.
- `admin`: everything, in particular container logs, `POST /api/containers/:id/update` and the self-update (doc 05).
- Mutating endpoints return 403 for viewers.

### R6 — CSRF protection for cookie auth (MUST, ships with R1)
- `SameSite=Lax` cookie **plus** origin verification on all state-changing requests: reject when `Sec-Fetch-Site` is present and not `same-origin`/`none`, or require a custom header (e.g. `X-Requested-With: kma-rma`) that simple cross-site forms cannot set.

### R7 — Transport security (MUST, deployment-level)
- The app MUST be reachable from the internet only via TLS: reverse proxy (Caddy/nginx) or tunnel (Cloudflare Tunnel, Tailscale/WireGuard). Direct port-forward of plain HTTP is explicitly unsupported; README gets a deployment section with a recommended setup.
- Cookies set with `Secure` (behind a proxy, trust `X-Forwarded-Proto` to detect HTTPS; allow opt-out for pure-LAN dev via env flag).
- HSTS at the proxy.

### R8 — Audit logging (SHOULD)
- Log to stdout (docker logs): login success/failure with IP and token name (never the token itself), blocks triggered by R3, and every mutating action with user name + target container.

### R9 — Security headers (SHOULD)
- `Content-Security-Policy: default-src 'self'` (plus what MUI needs for inline styles), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `frame-ancestors 'none'`.

### R10 — Reduce docker.sock blast radius (MUST — adopted, designed in doc 05)
- **Decision:** implemented by the dedicated updater-service architecture in `05-updater-service.md`: the dashboard container mounts no docker.sock at all. Mutations go through a narrow internal updater API (container-name-only, allowlisted, shared secret); reads (list/stats/logs) go through a read-only socket proxy (e.g. `tecnativa/docker-socket-proxy`). After this, a dashboard token compromise no longer implies host root — it guards the dashboard, not the system.

### R11 — Second factor / network-level gate (COULD)
- TOTP (e.g. `otplib`) for admin logins, or keep the app off the public internet entirely behind a VPN/tunnel with its own auth (Tailscale, Cloudflare Access). If a VPN gate is adopted, R1–R6 still apply as defense in depth.

---

## 3. Suggested phasing

| Phase | Scope | Outcome |
|-------|-------|---------|
| 1 | R1, R2, R3, R6, R9 + `Secure` cookie handling from R7 | Token no longer leaks; sessions expire; login is brute-force-resistant |
| 2 | R5, R8, R4 (hashed tokens), R11-docs | Least privilege + visibility |
| 3 | R10, R11 (TOTP) | Blast-radius reduction |

## 4. Acceptance criteria (Phase 1)

- [ ] No request after login carries the token in URL, body or storage; auth works via cookie for `fetch` and `EventSource`.
- [ ] Session cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, expires and is revoked when the token disappears from `TOKENS`.
- [ ] 10 failed logins from one IP block further attempts for 15 min (verified by test).
- [ ] Cross-site `POST /api/containers/:id/update` from a hostile page is rejected.
- [ ] `localStorage` no longer contains the token; PWA launched from home screen reuses the cookie session.
- [ ] Lighthouse/manual check shows the security headers from R9.

## 5. Non-goals

- Full user-management UI with password change flows (as in `class-evaluation`) — not justified at this scale; the `TOKENS` env remains the user store.
- Database-backed accounts.
