## RMA (RaspberryPi Management App)

### Overview
RMA is a lightweight app to monitor Raspberry Pi devices. MVP focuses on live metrics for CPU, RAM, and network traffic. Future iterations may add disk, processes, and alerting.

### MVP Goals (v0.1)
- Show near real-time metrics per Raspberry Pi:
  - CPU: usage %, temperature
  - RAM: total/used/free/available
  - Network: interface traffic, RX/TX throughput
- Docker container monitoring (when enabled):
  - Container list with CPU/RAM usage
  - Container logs streaming
  - Container pull image & restart
- Monitor only the host Raspberry Pi (single-device scope)
- Simple web dashboard with auto-refresh/streaming updates
- Historical metrics tracking with configurable buffer size
- Token-only access (required for API and UI)

### Metrics
RMA tracks the following system metrics:

**CPU Metrics:**
- Usage percentage
- Temperature (°C)

**Memory Metrics:**
- Total RAM
- Used RAM
- Free RAM
- Available RAM
- Usage percentage

**Network Metrics:**
- Per-interface statistics (RX/TX bytes)
- Total network throughput (RX/TX bytes per second)

All metrics are collected at a configurable interval (default: 2 seconds) and stored in an in-memory history buffer (default: 300 samples).

### Docker Container Monitoring

When Docker socket access is available, RMA provides additional container monitoring features:

**Container Statistics:**
- Real-time list of all running containers
- Per-container CPU usage percentage
- Per-container memory usage (percentage and MB)
- Auto-refresh via Server-Sent Events (SSE)

**Container Logs:**
- Stream container logs in real-time
- Configurable tail size (default: 200 lines, max: 1000)
- Follow mode for continuous log streaming

**Container Management:**
- Pull latest image and restart container
- Intelligent self-restart detection (uses detached mode when restarting RMA's own container)
- Update status reporting (image pulled, container recreated)

**Configuration:**
- Enable via `ENABLE_DOCKER_STATS=true` environment variable
- Requires Docker socket access (`/var/run/docker.sock`)
- Container broadcast interval: 5 seconds

### Router/Gateway Monitoring (TP-Link LTE)

When enabled, RMA can monitor your network's TP-Link LTE router (gateway), providing insights into internet connectivity and connected devices.

**Supported Routers:**
- TP-Link TL-MR100 (4G LTE Router)
- Other TP-Link MR series routers may work (untested)

**LTE Signal Metrics:**
- Signal strength (RSRP, RSRQ, SNR)
- Network type (4G LTE, 3G, etc.)
- Signal quality indicator (excellent/good/fair/poor)
- Historical signal strength chart

**WAN Traffic:**
- Real-time download/upload speed
- Total session transfer statistics
- Traffic history chart

**Connected Devices:**
- List of active devices on the network
- Device hostname, IP address, connection type
- Per-device traffic statistics

**Connection Status:**
- ISP/Operator name
- Connection uptime
- WAN IP address
- SIM card status

**Requirements:**
- Python 3.x with `tplinkrouterc6u` library installed
- Network access to router's web interface (typically 192.168.0.1)
- Router admin credentials

**Installation (Python dependency):**
```bash
pip3 install tplinkrouterc6u
```

**Configuration:**
- Enable via `ENABLE_ROUTER_STATS=true` environment variable
- Set router IP, username, and password via environment variables
- Default polling interval: 5 seconds (configurable)

### Prerequisites
- Node 18+
- pnpm
- Python 3.x + pip (required for router monitoring feature)
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

# Optional: enable Docker container monitoring (default false)
ENABLE_DOCKER_STATS=true

# Optional: max lines for container logs tail (default 1000)
LOGS_MAX_TAIL=1000

# Optional: enable router/gateway monitoring (default false)
ENABLE_ROUTER_STATS=false

# Router configuration (required when ENABLE_ROUTER_STATS=true)
ROUTER_IP=192.168.0.1
ROUTER_USERNAME=admin
ROUTER_PASSWORD=admin

# Optional: use HTTPS for router connection (default false)
# Requires "Local Management via HTTPS" enabled in router settings
ROUTER_HTTPS=false

# Optional: router polling interval in milliseconds (default 5000, min 3000)
ROUTER_POLL_INTERVAL_MS=5000

# Optional: router metrics history buffer size (default 60)
ROUTER_HISTORY_SIZE=60

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

### Enabling Docker Container Monitoring

To monitor Docker containers from within RMA, mount the Docker socket and enable the feature:

```bash
docker run --rm -p 3001:3001 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e TOKENS=devtoken->Developer \
  -e ENABLE_DOCKER_STATS=true \
  ghcr.io/krzycuh/kma-rma:latest
```

Or in `docker-compose.yml`:

```yaml
services:
  rma:
    image: ghcr.io/krzycuh/kma-rma:latest
    ports:
      - "3001:3001"
    environment:
      - TOKENS=devtoken->Developer
      - ENABLE_DOCKER_STATS=true
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

This enables:
- Container list with CPU/RAM usage
- Real-time container logs streaming
- Container image pull and restart functionality

### Enabling Router/Gateway Monitoring

To monitor your TP-Link LTE router from within RMA:

```bash
docker run --rm -p 3001:3001 \
  -e TOKENS=devtoken->Developer \
  -e ENABLE_ROUTER_STATS=true \
  -e ROUTER_IP=192.168.0.1 \
  -e ROUTER_USERNAME=admin \
  -e ROUTER_PASSWORD=your_router_password \
  ghcr.io/krzycuh/kma-rma:latest
```

Or in `docker-compose.yml`:

```yaml
services:
  rma:
    image: ghcr.io/krzycuh/kma-rma:latest
    ports:
      - "3001:3001"
    environment:
      - TOKENS=devtoken->Developer
      - ENABLE_ROUTER_STATS=true
      - ROUTER_IP=192.168.0.1
      - ROUTER_USERNAME=admin
      - ROUTER_PASSWORD=your_router_password
      - ROUTER_POLL_INTERVAL_MS=5000
```

**Note:** The Docker image includes Python 3 and the `tplinkrouterc6u` library pre-installed.

This enables:
- LTE signal quality monitoring (RSRP, RSRQ, SNR)
- WAN traffic statistics
- Connected devices list
- Connection status and uptime

### Raspberry Pi prerequisites and container mounts

Thermal readings require access to system interfaces and optionally Raspberry Pi firmware tools:

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
- Without these mounts/capabilities, CPU temperature readings may be null.
- Network statistics are read from `/proc/net/dev` and should work without special privileges.

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

### Running the App for Development

After setting up your environment, run the app in development mode:

**Option 1: Full stack development (recommended)**
```bash
# Terminal 1: Start backend (with hot reload)
pnpm dev

# Terminal 2: Start frontend dev server (with hot reload)
pnpm --filter frontend dev
```

Then visit `http://localhost:5173/?token=aaa` (Vite dev server proxies API to backend)

**Option 2: Backend only**
```bash
pnpm dev
pnpm build  # Build frontend once
```

Then visit `http://localhost:3001/?token=aaa` (backend serves built frontend)

**Option 3: Docker development**
```bash
docker build -t kma-rma:dev .
docker run --rm -p 3001:3001 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e TOKENS=aaa->Dev \
  -e ENABLE_DOCKER_STATS=true \
  kma-rma:dev
```

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

