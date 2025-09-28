## RMA (RaspberryPi Management App)

### Overview
RMA is a lightweight app to monitor Raspberry Pi devices. MVP focuses on live metrics for CPU, RAM, and basic GPU information (temperature/memory). Future iterations may add disk, network, processes, and alerting.

### MVP Goals (v0.1)
- Show near real-time metrics per Raspberry Pi:
  - CPU: usage %, temperature, clock
  - RAM: total/used/free
  - GPU: temperature, memory (utilization if feasible)
- Monitor only the host Raspberry Pi (single-device scope)
- Simple web dashboard with auto-refresh/streaming updates
- Token-only access (required for API and UI)

### Prerequisites
- Node 18+
- pnpm
- Docker (optional, for containerized runs)
- fish shell (optional, for helper scripts)

### Repository Layout
- `backend/` – Node + TypeScript HTTP server (no Express), outputs to `backend/dist`
- `frontend/` – React + Vite SPA, outputs to `frontend/dist`
- `Dockerfile` and `docker-compose.yml` – containerization
- Helper scripts: `build-and-export.fish`, `copy-and-load-to-rpi.fish`

## Environment
Create a `.env` file at the repository root (parent of `backend/`). The backend scripts read `../.env`.

```env
# Required: map of token->DisplayName pairs
TOKENS=aaa->User1,bbb->User2

# Optional: backend port (default 3001)
PORT=3001

# Optional: bind address (default 127.0.0.1). Use 0.0.0.0 to expose on LAN
HOST=127.0.0.1

# Optional: metrics poll interval in milliseconds (default 2000)
METRICS_POLL_INTERVAL_MS=2000

# Optional: in-memory history buffer size (default 300)
METRICS_HISTORY_SIZE=300

# Optional: working dir hint for serving built frontend (normally not needed locally)
# NODE_CWD=/app/backend
```

Notes:
- Static files are served from `<NODE_CWD or process.cwd>/../frontend/dist` in production.
- All API endpoints expect a `?token=<token>` query parameter.

## Install
At the monorepo root:

```bash
pnpm install
```

## Development
You can run backend-only, or run backend and Vite dev server side-by-side.

### Backend (TypeScript, nodemon)
Runs on port 3001 and reads `../.env`.

```bash
pnpm dev
# → equivalent to: pnpm --filter backend dev
```

Open the app using the Vite dev server (below) or against the built frontend once you build it.

### Frontend (Vite dev server)
Vite proxies `/api` to `http://localhost:3001`.

```bash
pnpm --filter frontend dev
```

Access during dev:
- Vite: `http://localhost:5173/?token=aaa`
- Backend API (direct): `http://localhost:3001/api/user?token=aaa`
- Health: `http://localhost:3001/api/health?token=aaa`

## Build and Run (Production-like)
Build both workspaces, then start the backend which serves the built SPA.

```bash
pnpm build         # builds backend then frontend
pnpm start         # starts backend on PORT (default 3001)
```

Access: `http://localhost:3001/?token=aaa`

### Clean
```bash
pnpm clean
```

## Testing (backend)
```bash
pnpm --filter backend test
```

## Docker

### Build and run locally
```bash
docker build -t kma-rma:latest .
docker run --rm -p 3001:3001 -e TOKENS=devtoken->Developer kma-rma:latest
```

Open: `http://localhost:3001/?token=devtoken`

### Using docker-compose
`docker-compose.yml` provides a minimal service definition:

```bash
docker compose up -d
```

## ARM64 image export and Raspberry Pi deploy (optional)
Helper scripts expect fish shell and an SSH-accessible target.

```bash
./build-and-export.fish
# produces target/kma-rma-arm.tar

./copy-and-load-to-rpi.fish pi@raspberrypi.local
# scps the tar, docker loads it on the RPi, and restarts the compose service
```

## Command Reference

```bash
# Monorepo root
pnpm install                # install all workspaces
pnpm dev                    # backend dev (nodemon + ts-node)
pnpm start                  # start built backend (serves built frontend)
pnpm build                  # build backend then frontend
pnpm clean                  # clean backend, frontend, and root node_modules

# Individual workspaces
pnpm --filter backend dev   # backend dev
pnpm --filter backend build # backend build
pnpm --filter frontend dev  # frontend dev (Vite)
pnpm --filter frontend build# frontend build
```

## Quickstart
1) `pnpm install`
2) Create `.env` with at least `TOKENS=aaa->User1`
3) In one terminal: `pnpm dev` (backend)
4) In another: `pnpm --filter frontend dev` (Vite)
5) Visit `http://localhost:5173/?token=aaa`


