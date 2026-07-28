export const PORT = parseInt(process.env.PORT || '3002', 10);
export const HOST = process.env.HOST || '0.0.0.0';

export const DOCKER_SOCK_PATH = process.env.DOCKER_SOCK_PATH || '/var/run/docker.sock';

// Shared secret required on every request (except /health).
export const MANAGER_TOKEN = process.env.MANAGER_TOKEN || '';

// Explicit list of container names this service is allowed to update.
export const ALLOWED_CONTAINERS = (process.env.ALLOWED_CONTAINERS || '')
  .split(',')
  .map(name => name.trim())
  .filter(Boolean);

// How long a freshly started container must stay Running (no HEALTHCHECK case).
export const VERIFY_STABLE_MS = parseInt(process.env.VERIFY_STABLE_MS || '10000', 10);
// Overall verification deadline (covers HEALTHCHECK start periods).
export const VERIFY_TIMEOUT_MS = parseInt(process.env.VERIFY_TIMEOUT_MS || '60000', 10);
// Grace period before stopping the target, so its HTTP response/SSE notice can flush.
export const PRE_STOP_DELAY_MS = parseInt(process.env.PRE_STOP_DELAY_MS || '3000', 10);
