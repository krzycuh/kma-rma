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
      org.opencontainers.image.version=$VERSION \
      org.opencontainers.image.title="KMA RMA" \
      org.opencontainers.image.description="Raspberry Pi Management Application"

WORKDIR /app

RUN corepack enable

# Install Python 3 and pip for router monitoring feature
RUN apk add --no-cache python3 py3-pip

# Install tplinkrouterc6u library for TP-Link router API
RUN pip3 install --no-cache-dir --break-system-packages tplinkrouterc6u

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
RUN pnpm install --prod --frozen-lockfile --filter backend

COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist

# Copy Python scripts for router monitoring
COPY backend/scripts ./backend/scripts

EXPOSE 3001
ENV NODE_CWD=/app/backend

CMD ["node", "backend/dist/src/server.js"]


