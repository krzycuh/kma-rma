# CI/CD Implementation with GitHub Actions

**Status:** Planning
**Priority:** High (should be implemented first)
**Estimated Complexity:** Low

## Objective

Implement automated CI/CD pipeline using GitHub Actions to:
1. Run automated tests and quality checks on every push/PR
2. Build and publish Docker images to GitHub Container Registry (GHCR)
3. Support multi-platform builds (amd64, arm64) for Raspberry Pi deployment
4. Follow semantic versioning pattern from `kms-poker-stats` repository

---

## Reference Architecture

Based on `kms-poker-stats` repository workflows:

### Pattern Overview
- **CI Workflows**: Separate workflows for backend and frontend
  - Run on push/PR to main/develop
  - Lint, test, build, security scan
  - Build Docker image (no push)

- **CD Workflow**: Production deployment
  - Trigger on release publication or manual dispatch
  - Authenticate to GHCR using `GITHUB_TOKEN`
  - Build multi-platform images (amd64, arm64/v8)
  - Push with semantic version tags
  - Post-deployment notifications

---

## Adaptation for kma-rma

### Key Differences

| Aspect | kms-poker-stats | kma-rma |
|--------|----------------|---------|
| Architecture | Separate backend/frontend Dockerfiles | **Monorepo with single Dockerfile** |
| Backend | Spring Boot (Java/Kotlin) | Node.js (TypeScript) |
| Frontend | Separate service | Built into backend container |
| Package Manager | Gradle (backend), npm (frontend) | pnpm (monorepo) |
| Testing | JUnit, Jest | Not yet implemented |
| Linting | ktlint, ESLint | Not yet configured |
| **CI Workflows** | **Split: backend-ci.yml + frontend-ci.yml** | **🎯 Unified: Single ci.yml** |

### Required Workflows

**IMPORTANT:** Unlike kms-poker-stats which has separate CI workflows for backend and frontend, **kma-rma uses a SINGLE unified workflow** since both are built together in one Dockerfile.

#### 1. **Unified CI Workflow** (`ci.yml`)
   - **Single workflow for entire monorepo**
   - Run on every push/PR
   - Install dependencies (pnpm)
   - Lint backend AND frontend together
   - Type check both TypeScript projects
   - Build both projects in sequence
   - Validate Docker build (which builds both together)

#### 2. **Deploy Workflow** (`deploy.yml`)
   - Trigger on releases or manual dispatch
   - Build single multi-platform Docker image (contains both backend + frontend)
   - Push to GHCR with version tags
   - Post-deployment tasks

---

## Implementation Plan

### Phase 1: Setup Linting & Testing (Prerequisite)

Before CI/CD can be valuable, we need quality checks to run:

#### Backend Linting
```bash
cd backend
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

**`.eslintrc.json`:**
```json
{
  "parser": "@typescript-eslint/parser",
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "env": { "node": true }
}
```

**`backend/package.json`:**
```json
{
  "scripts": {
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix"
  }
}
```

#### Frontend Linting
```bash
cd frontend
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react eslint-plugin-react-hooks
```

**Frontend already has `lint` script** - verify it's properly configured.

#### Testing
- **Backend**: Add basic tests with Jest or Vitest
  - Test procStat parsing
  - Test meminfo parsing
  - Test network stats parsing
  - Test metrics service

- **Frontend**: Add React Testing Library tests
  - Component rendering
  - Data fetching
  - Error handling

**For MVP**: Can skip tests initially and add linting only.

---

### Phase 2: CI Workflow

**`.github/workflows/ci.yml`:**

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-build:
    name: Lint and Build
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Enable Corepack
        run: corepack enable

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint backend
        run: pnpm --filter backend lint

      - name: Lint frontend
        run: pnpm --filter frontend lint

      - name: Type check backend
        run: pnpm --filter backend tsc --noEmit

      - name: Type check frontend
        run: pnpm --filter frontend tsc --noEmit

      - name: Build backend
        run: pnpm --filter backend build

      - name: Build frontend
        run: pnpm --filter frontend build

      # Optional: Run tests when implemented
      # - name: Test backend
      #   run: pnpm --filter backend test
      #
      # - name: Test frontend
      #   run: pnpm --filter frontend test

  docker-build:
    name: Validate Docker Build
    runs-on: ubuntu-latest
    needs: lint-and-build

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build Docker image (validation only)
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: false
          tags: kma-rma:test
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

### Phase 3: Deploy Workflow

**`.github/workflows/deploy.yml`:**

```yaml
name: Deploy to GHCR

on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      version:
        description: 'Version tag to deploy'
        required: false
        default: 'latest'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    name: Build and Push Docker Image
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=ref,event=branch
            type=sha
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          platforms: linux/amd64,linux/arm64/v8
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            BUILD_DATE=${{ steps.meta.outputs.created }}
            VCS_REF=${{ github.sha }}
            VERSION=${{ github.ref_name }}

      - name: Image digest
        run: echo ${{ steps.meta.outputs.digest }}

  post-deploy:
    name: Post-Deployment
    needs: build-and-push
    runs-on: ubuntu-latest

    steps:
      - name: Deployment notification
        run: |
          echo "✅ Deployed version: ${{ github.ref_name }}"
          echo "📦 Image: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}"
          echo "🏷️  Tags: ${{ needs.build-and-push.outputs.tags }}"
```

---

### Phase 4: Update Dockerfile with Build Args

**Update `Dockerfile`** to accept build arguments:

```dockerfile
# Stage 1: Builder
FROM node:18-alpine AS builder

ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

LABEL org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.version=$VERSION \
      org.opencontainers.image.title="KMA RMA" \
      org.opencontainers.image.description="Raspberry Pi Management Application"

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN pnpm install --frozen-lockfile

COPY backend backend
COPY frontend frontend

RUN pnpm --filter frontend build
RUN pnpm --filter backend build

# Stage 2: Runtime
FROM node:18-alpine

ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

LABEL org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.version=$VERSION

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
RUN pnpm install --prod --frozen-lockfile --filter backend

COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 3001
ENV NODE_CWD=/app/backend

CMD ["node", "backend/dist/server.js"]
```

---

## Deployment Tags

Based on kms-poker-stats pattern, images will be tagged with:

| Trigger | Tags Generated | Example |
|---------|---------------|---------|
| Release `v1.2.3` | `1.2.3`, `1.2`, `sha-abc123` | `ghcr.io/user/kma-rma:1.2.3` |
| Push to main | `main`, `sha-abc123`, `latest` | `ghcr.io/user/kma-rma:latest` |
| Push to develop | `develop`, `sha-abc123` | `ghcr.io/user/kma-rma:develop` |
| Manual dispatch | User-provided + `sha-abc123` | `ghcr.io/user/kma-rma:custom` |

---

## Using Published Images

### Pull from GHCR

```bash
# Public repository (after making package public)
docker pull ghcr.io/krzycuh/kma-rma:latest

# Private repository (requires authentication)
echo $GITHUB_TOKEN | docker login ghcr.io -u krzycuh --password-stdin
docker pull ghcr.io/krzycuh/kma-rma:1.0.0
```

### Docker Compose

**`docker-compose.yml`:**
```yaml
version: '3.8'

services:
  kma-rma:
    image: ghcr.io/krzycuh/kma-rma:latest
    container_name: rpi-manager
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - TOKENS=your-secure-token->YourName
      - PORT=3001
      - HOST=0.0.0.0
      - METRICS_POLL_INTERVAL_MS=2000
      - METRICS_HISTORY_SIZE=300
      - ENABLE_DOCKER_STATS=true
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro  # For Docker stats
    privileged: false  # Use if temp reading requires it
```

### Run on Raspberry Pi

```bash
# Pull and run
docker pull ghcr.io/krzycuh/kma-rma:latest
docker run -d \
  --name rpi-manager \
  --restart unless-stopped \
  -p 3001:3001 \
  -e TOKENS=your-token->Admin \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  ghcr.io/krzycuh/kma-rma:latest
```

---

## Repository Settings

### Required Settings

1. **Enable GitHub Packages**
   - Repository Settings → Packages
   - Ensure package visibility matches repository (public/private)

2. **Branch Protection** (recommended)
   - Protect `main` branch
   - Require status checks (CI workflow) before merge
   - Require pull request reviews

3. **Secrets** (none required for GHCR)
   - `GITHUB_TOKEN` is automatically provided by GitHub Actions
   - No need to create additional secrets for basic GHCR push

4. **Make Package Public** (optional)
   - Navigate to package in GHCR
   - Package Settings → Change visibility → Public
   - Allows anyone to pull without authentication

---

## Workflow Triggers

### Creating a Release

```bash
# Tag and push
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Create GitHub Release (triggers deploy workflow)
# Via GitHub UI: Releases → Create Release → Select tag v1.0.0
```

Or use GitHub CLI:
```bash
gh release create v1.0.0 --title "v1.0.0" --notes "Initial release with CPU, RAM, Docker metrics"
```

### Manual Deployment

```bash
# Via GitHub Actions UI
# Actions → Deploy to GHCR → Run workflow → Select branch → Enter version
```

---

## File Structure

After implementation:

```
kma-rma/
├── .github/
│   └── workflows/
│       ├── ci.yml              # NEW: Unified CI (backend + frontend together)
│       └── deploy.yml          # NEW: Deploy to GHCR (single image)
│
├── backend/
│   ├── .eslintrc.json          # NEW: Backend linting config
│   ├── package.json            # UPDATE: Add lint script
│   └── src/...
│
├── frontend/
│   ├── .eslintrc.json          # UPDATE: Verify frontend linting
│   ├── package.json            # VERIFY: lint script exists
│   └── src/...
│
├── Dockerfile                  # UPDATE: Add build args and labels
│                               #         (Builds BOTH backend + frontend)
└── docs/
    └── planning/
        └── 03-cicd-implementation.md
```

**Total: 2 workflow files** (not split by backend/frontend)

---

## Testing the Workflow

### Step-by-Step Validation

1. **Test CI locally:**
   ```bash
   # Install dependencies
   pnpm install

   # Run linters
   pnpm --filter backend lint
   pnpm --filter frontend lint

   # Type check
   pnpm --filter backend tsc --noEmit
   pnpm --filter frontend tsc --noEmit

   # Build
   pnpm --filter backend build
   pnpm --filter frontend build
   ```

2. **Test Docker build locally:**
   ```bash
   docker buildx build \
     --platform linux/amd64,linux/arm64/v8 \
     --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
     --build-arg VCS_REF=$(git rev-parse --short HEAD) \
     --build-arg VERSION=test \
     -t kma-rma:test \
     .
   ```

3. **Push to GitHub and verify CI:**
   - Create feature branch
   - Push changes
   - Verify CI workflow runs and passes
   - Check GitHub Actions tab for results

4. **Test release workflow:**
   - Create test release (e.g., `v0.1.0-beta`)
   - Verify deploy workflow triggers
   - Check GHCR for published image
   - Pull and run image to validate

---

## Estimated Effort

| Task | Time Estimate |
|------|---------------|
| Setup linting (backend + frontend) | 1-2 hours |
| Create CI workflow | 30 min |
| Create deploy workflow | 30 min |
| Update Dockerfile with build args | 15 min |
| Test workflows locally | 1 hour |
| Create test release and validate | 30 min |
| Documentation updates | 30 min |
| **Total** | **4-5 hours** |

---

## Benefits

1. ✅ **Automated Quality Checks**: Every PR runs linters and builds
2. ✅ **Consistent Builds**: Docker builds identical images every time
3. ✅ **Multi-platform Support**: One workflow builds for amd64 and arm64
4. ✅ **Version Management**: Semantic versioning with automatic tagging
5. ✅ **Easy Deployment**: Pull pre-built images instead of building on Raspberry Pi
6. ✅ **Faster Iterations**: Subsequent feature development has CI safety net

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Multi-platform build fails | High | Test locally first with `docker buildx` |
| GHCR authentication issues | Medium | Use `GITHUB_TOKEN` (auto-provided) |
| Linting fails on existing code | Low | Fix linting issues or adjust rules |
| Build time too long | Low | Use GitHub Actions cache |
| Raspberry Pi can't pull arm64 image | High | Ensure platform `linux/arm64/v8` included |

---

## Success Criteria

- [ ] CI workflow runs on every push/PR
- [ ] CI validates linting, type checking, and builds
- [ ] Deploy workflow triggered by releases
- [ ] Docker image published to GHCR with correct tags
- [ ] Multi-platform image works on Raspberry Pi (arm64)
- [ ] Image can be pulled and run successfully
- [ ] Documentation updated with deployment instructions

---

## Next Steps After CI/CD

With CI/CD in place, future development becomes more efficient:

1. **Communication Unification** - Can refactor safely with CI validation
2. **Network Metrics** - Add feature with automated testing
3. **Container Logs** - Complete SSE implementation with CI checks
4. **Testing** - Add unit/integration tests incrementally
5. **Monitoring** - Set up workflow notifications (Slack/Discord)

---

## Summary

CI/CD implementation provides the foundation for reliable, rapid development. By following the kms-poker-stats pattern and adapting it for the monorepo structure, we establish:

- Automated quality gates
- Multi-platform Docker builds
- Version-controlled releases
- Easy deployment to Raspberry Pi

**Recommendation: Implement CI/CD first, then proceed with feature development.**
