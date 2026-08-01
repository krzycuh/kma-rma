export const PORT = parseInt(process.env.PORT || '3002', 10);
export const HOST = process.env.HOST || '0.0.0.0';

export const DOCKER_SOCK_PATH = process.env.DOCKER_SOCK_PATH || '/var/run/docker.sock';

// Shared secret required on every request (except /health).
export const MANAGER_TOKEN = process.env.MANAGER_TOKEN || '';

// Optional restriction of manageable container names (update, stop, start).
// Unset (or '*') means every container may be managed — same behavior the
// dashboard had before the manager existed. Set a comma-separated list to restrict.
export const ALLOWED_CONTAINERS = (process.env.ALLOWED_CONTAINERS || '')
  .split(',')
  .map(name => name.trim())
  .filter(Boolean);

export const ALLOW_ALL_CONTAINERS =
  ALLOWED_CONTAINERS.length === 0 || ALLOWED_CONTAINERS.includes('*');

export function isContainerAllowed(name: string): boolean {
  return ALLOW_ALL_CONTAINERS || ALLOWED_CONTAINERS.includes(name);
}

// How long a freshly started container must stay Running (no HEALTHCHECK case).
export const VERIFY_STABLE_MS = parseInt(process.env.VERIFY_STABLE_MS || '10000', 10);
// Overall verification deadline (covers HEALTHCHECK start periods).
export const VERIFY_TIMEOUT_MS = parseInt(process.env.VERIFY_TIMEOUT_MS || '60000', 10);
// Grace period before stopping the target, so its HTTP response/SSE notice can flush.
export const PRE_STOP_DELAY_MS = parseInt(process.env.PRE_STOP_DELAY_MS || '3000', 10);
