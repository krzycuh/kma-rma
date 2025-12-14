## RMA (RaspberryPi Management App)

### Overview
RMA is a lightweight app to monitor Raspberry Pi devices. MVP focuses on live metrics for CPU, RAM, and basic GPU information (temperature/memory). Future iterations may add disk, network, processes, and alerting.

### MVP Goals (v0.1)
- Show near real-time metrics per Raspberry Pi:
  - CPU: usage %, temperature, clock speed
  - RAM: total/used/free/available
  - GPU: temperature, memory allocation
  - System: uptime, load average
- Monitor only the host Raspberry Pi (single-device scope)
- Simple web dashboard with auto-refresh/streaming updates
- Historical metrics tracking with configurable buffer size
- Token-only access (required for API and UI)

### Metrics
RMA tracks the following system metrics:

**CPU Metrics:**
- Usage percentage (overall and per-core)
- Temperature (°C)
- Clock frequency (MHz)
- Load average (1m, 5m, 15m)

**Memory Metrics:**
- Total RAM
- Used RAM
- Free RAM
- Available RAM
- Usage percentage

**GPU Metrics:**
- Temperature (°C)
- Memory allocation (MB)

**System Information:**
- Uptime
- Hostname
- OS information
- Kernel version

All metrics are collected at a configurable interval (default: 2 seconds) and stored in an in-memory history buffer (default: 300 samples).

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

### Installing from GitHub Container Registry (GHCR)

Pre-built multi-architecture images (amd64, arm64) are available from GitHub Container Registry:

```bash
# Pull the latest version
docker pull ghcr.io/krzycuh/kma-rma:latest

# Run the image
docker run --rm -p 3001:3001 \
  --privileged \
  -e TOKENS=devtoken->Developer \
  ghcr.io/krzycuh/kma-rma:latest
```

Access the app at: `http://localhost:3001/?token=devtoken`

**Available tags:**
- `latest` - Latest stable release
- `<version>` - Specific version (e.g., `v1.0.0`)
- `<sha>` - Specific commit SHA

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

### Raspberry Pi prerequisites and container mounts

`vcgencmd` and thermal/clock readings require Raspberry Pi firmware tools and access to system interfaces:

- Ensure `vcgencmd` is available on the host:
  - On Raspberry Pi OS, install: `sudo apt update && sudo apt install -y libraspberrypi-bin`
  - Some features may require enablement in `sudo raspi-config`.
- When running in Docker, grant the container access to host metrics:
  - Option A (simplest): run privileged
    - docker run --rm -p 3001:3001 \
      --privileged \
      -e TOKENS=devtoken->Developer \
      kma-rma:latest
  - Option B (more constrained): mount specific paths and binary
    - docker run --rm -p 3001:3001 \
      -v /proc:/proc:ro \
      -v /sys:/sys:ro \
      -v /usr/bin/vcgencmd:/usr/bin/vcgencmd:ro \
      -e TOKENS=devtoken->Developer \
      kma-rma:latest

Notes:
- Without these mounts/capabilities, CPU temp/clock and GPU memory may be null.
- Some models expose a single thermal sensor; GPU temp may mirror CPU temp.

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

## Contributing

We welcome contributions to RMA! Here's how you can help:

### Getting Started
1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/kma-rma.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Install dependencies: `pnpm install`
5. Set up your `.env` file with test tokens

### Development Workflow
1. Make your changes in the appropriate workspace (`backend/` or `frontend/`)
2. Follow the existing code style and conventions
3. Run linters before committing:
   - Backend: `pnpm --filter backend lint`
   - Frontend: `pnpm --filter frontend lint`
4. Type-check your code:
   - Backend: `pnpm --filter backend tsc --noEmit`
   - Frontend: `pnpm --filter frontend tsc --noEmit`
5. Test your changes locally
6. Build to ensure everything compiles: `pnpm build`

### Submitting Changes
1. Commit your changes with clear, descriptive messages
2. Push to your fork: `git push origin feature/your-feature-name`
3. Open a Pull Request against the `main` branch
4. Ensure CI checks pass (linting, type-checking, building)
5. Wait for review and address any feedback

### Code Style
- Use TypeScript for all backend and frontend code
- Follow the existing ESLint configuration
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions focused and testable

### Areas for Contribution
- Bug fixes and error handling improvements
- Additional metrics and monitoring features
- UI/UX enhancements
- Documentation improvements
- Test coverage
- Performance optimizations

### Questions or Issues?
- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- Provide detailed information and steps to reproduce bugs

Thank you for contributing to RMA!

