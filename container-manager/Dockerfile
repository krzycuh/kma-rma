# Build from the repository root:
#   docker build -f container-manager/Dockerfile .

# Stage 1: Builder
FROM node:18-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY container-manager/package.json container-manager/package.json

RUN pnpm install --frozen-lockfile --filter container-manager

COPY container-manager container-manager

RUN pnpm --filter container-manager build

# Stage 2: Runtime (no runtime dependencies — plain Node)
FROM node:18-alpine

ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

LABEL org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.version=$VERSION \
      org.opencontainers.image.title="KMA RMA Container Manager" \
      org.opencontainers.image.description="Read-only Docker API proxy and container update service"

WORKDIR /app

COPY --from=builder /app/container-manager/dist ./dist

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3002/health || exit 1

CMD ["node", "dist/server.js"]
