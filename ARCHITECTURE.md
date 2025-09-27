### KMA WOL App – Architecture and Reuse Guide

This document summarizes the architecture, technologies, libraries, environment/config, API, installation, development workflow, and deployment utilities of this project. It is designed so you can reuse the same patterns to build similar apps that do different things.

## Overview
- **Monorepo** managed by pnpm workspaces: `frontend/` (React SPA) and `backend/` (Node HTTP server).
- **Backend** is a minimal TypeScript app using Node’s `http` module (no Express), serving API endpoints and static files from the built frontend.
- **Frontend** is a React + TypeScript + Vite SPA with Material UI and Tailwind for UI.
- **Auth** is token-based via URL query param `?token=...` validated against env-defined tokens.
- **Deployment**: single Docker image with multi-stage build; helper fish scripts to build for ARM64 and deploy to Raspberry Pi.

## Technology Stack
- **Package manager/Monorepo**: pnpm workspaces
- **Backend**: Node 18, TypeScript, Node `http`; libs: `dotenv`; testing: Jest, ts-jest, Supertest
- **Frontend**: React 19, Vite 7, TypeScript 5, MUI 7, Emotion, TailwindCSS; ESLint 9
- **Build/Deploy**: Docker multi-stage, buildx for linux/arm64; fish shell utilities

## Repository Layout
- `backend/`: TypeScript source, tests, and build output to `backend/dist`
  - `src/server.ts`: entry; HTTP server, routing pipeline, auth, static serving
  - `src/routes/`: `apiRoutes.ts`, `pageRoutes.ts`, `staticRoutes.ts`
  - `src/controllers/`: request handlers and domain logic
  - `src/middleware/`: `auth.ts`, `staticFiles.ts`
  - `src/utils/`: `ControllerResult.ts`, `logger.ts`, `urlParser.ts`
- `frontend/`: React app, built to `frontend/dist`
- `Dockerfile`, `docker-compose.yml`, fish scripts for build and deploy

## Backend Architecture
Pipeline in `src/server.ts`:
1) Static files first (no auth) → `handleStaticRoutes`
2) Token auth for non-static routes → `validateToken`
3) API routes (JSON) → `handleApiRoutes`
4) Page routes (SPA fallback) → `handlePageRoutes`
5) 404 handler

Key modules:
- `config/index.ts`: reads env and exposes `PORT`, `PUBLIC_DIR`, and token map
- `middleware/auth.ts`: validates `token` query param
- `middleware/staticFiles.ts`: static file streaming with content types
- `utils/ControllerResult.ts`: unified result types for HTTP responses

### Environment and Configuration
Set via env variables (see examples):
- `PORT`: backend port (default 3000)
- `TOKENS`: comma-separated `token->UserName` pairs
  - Example: `TOKENS=aaa->User1,bbb->User2`
- `NODE_CWD`: working dir base for locating `PUBLIC_DIR` and logs (defaults to process cwd)

PUBLIC_DIR resolution: `<NODE_CWD>/../frontend/dist` so the backend serves the built SPA directly.

### API Endpoints
All endpoints expect `?token=<token>` in the query string.
- `GET /api/user` → `{ name: string }` – validates token, returns user name
- `GET /api/metrics` → current host metrics snapshot (CPU, RAM, GPU)
- `GET /api/metrics/history?limit=N` → recent samples from in-memory buffer
- Optional streaming: `GET /api/metrics/stream` (SSE) or `WS /ws` for live updates

### Static/Pages
- Static assets served from `frontend/dist` when URL has an extension
- `GET /` serves SPA `index.html`
- `GET /unauthorized` serves `public/unauthorized.html`
- `404` serves `public/404.html` if present

## Frontend Architecture
- SPA in `frontend/` using React + MUI + Tailwind
- `hooks/useAppState.ts`: app state orchestration (auth via URL token, initial data load)
- `hooks/useApi.ts`: API calls; shows snackbar feedback on results
- Components: `AuthScreen`, `Header`, `LoadingScreen`, `NotificationSnackbar`, plus feature-specific components
- Styling: Tailwind utility classes + MUI components (Emotion styling)

### Auth Flow (SPA)
1) Read `token` from `window.location.search`
2) Call `/api/user?token=...`; if 200 → show main app, else show `AuthScreen`
3) Load feature data and provide feature-specific actions

## Install, Build, Test, Run
Prereqs: Node 18+, pnpm, Docker (optional), fish shell (for helper scripts).

At monorepo root:
- Install all: `pnpm install`
- Dev backend: `pnpm dev` (runs backend with ts-node + nodemon; expects `.env`)
- Start backend (built): `pnpm start`
- Build all: `pnpm build` (backend then frontend)
- Clean all: `pnpm clean`
- Tests (backend): `pnpm test`, or `test:unit`, `test:integration`, `test:e2e`, `test:coverage`, `test:watch:*`

Backend env files:
- Dev/test scripts use `dotenv -e ../.env` and `../.env.test` inside `backend/` scripts

## Docker and Deployment
- `Dockerfile`: multi-stage build
  - Stage builder: installs workspace deps, builds `frontend` and `backend`
  - Stage runtime: installs only backend production deps, copies built artifacts, `EXPOSE 3000`, `CMD node backend/dist/src/server.js`
- `docker-compose.yml` minimal example:
  - Maps port 3000, sets `TOKENS`, restarts unless-stopped

Helper scripts (fish):
- `build-and-export.fish`: build linux/arm64 image via `docker buildx`, save to `target/kma-wol-app-arm.tar`
- `copy-and-load-to-rpi.fish <user@host>`: scp tar to RPi, `docker load`, and `docker compose up -d --force-recreate kma-wol-app`

## Reusing This Template for Other Apps
Keep the same monorepo structure and swap domain logic:
1) Backend
   - Keep `server.ts` pipeline and `ControllerResult` helpers
   - Implement new controllers in `src/controllers` and wire them in `src/routes/apiRoutes.ts`
   - Define your env-driven config in `src/config/index.ts` (similar to `TOKENS`, domain lists, etc.)
   - Extend `pageRoutes.ts` and static files as needed
2) Frontend
   - Keep `useAppState` and `useApi` patterns; adapt endpoints and UI components
   - Continue using MUI + Tailwind or swap UI libs as needed
3) Ops
   - Reuse Dockerfile as-is; adjust container name/image in scripts/compose
   - Update `docker-compose.yml` env vars for your app

Guidelines:
- Prefer simple, explicit routing with small pure controllers
- Keep responses standardized using `ControllerResult`
- Drive runtime config from env so the same image works in multiple environments
- Keep frontend served by backend in production to ship a single container

## Quickstart
1) `pnpm install`
2) Create `.env` in `backend/` parent with at least:
   - `TOKENS=aaa->User1`
3) `pnpm dev` (backend only) or build then run docker
4) Open `http://localhost:3000/?token=aaa`


