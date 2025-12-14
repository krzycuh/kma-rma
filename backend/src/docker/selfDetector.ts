import { dockerJsonRequest } from './client';
import { readFileSync } from 'fs';
import { hostname } from 'os';

/**
 * Detects if the given container ID or name refers to the current running container
 */

let cachedSelfContainerId: string | null = null;

/**
 * Get the current container ID by reading from cgroup
 * This works when the backend is running inside a Docker container
 */
function getSelfContainerIdFromCgroup(): string | null {
  try {
    const cgroup = readFileSync('/proc/self/cgroup', 'utf8');
    // Look for patterns like:
    // 12:memory:/docker/<container-id>
    // or newer cgroup v2: 0::/docker/<container-id>
    const match = cgroup.match(/\/docker\/([a-f0-9]{64})/);
    if (match) {
      return match[1];
    }

    // Alternative pattern for some Docker setups
    const match2 = cgroup.match(/docker-([a-f0-9]{64})\.scope/);
    if (match2) {
      return match2[1];
    }
  } catch {
    // Not running in Docker or /proc/self/cgroup not accessible
    return null;
  }

  return null;
}

/**
 * Get self container ID from hostname
 * In Docker, the hostname is typically the first 12 characters of container ID
 */
function getSelfContainerIdFromHostname(): string | null {
  try {
    const host = hostname();
    // Docker hostnames are 12 chars from container ID
    if (host && /^[a-f0-9]{12}$/.test(host)) {
      return host;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Get the current container's full ID
 * Returns null if not running in a container
 */
export async function getSelfContainerId(): Promise<string | null> {
  if (cachedSelfContainerId) {
    return cachedSelfContainerId;
  }

  // Try cgroup first (most reliable for full ID)
  const cgroupId = getSelfContainerIdFromCgroup();
  if (cgroupId) {
    cachedSelfContainerId = cgroupId;
    return cgroupId;
  }

  // Try hostname (gives short ID, need to expand via Docker API)
  const hostnameId = getSelfContainerIdFromHostname();
  if (hostnameId) {
    try {
      // Try to find full ID by listing containers and matching short ID
      const containers = await dockerJsonRequest<Array<{ Id: string; Names: string[] }>>({
        path: '/containers/json',
        method: 'GET'
      });

      for (const container of containers) {
        if (container.Id.startsWith(hostnameId)) {
          cachedSelfContainerId = container.Id;
          return container.Id;
        }
      }
    } catch {
      // Docker API not accessible, return short ID
      return hostnameId;
    }
  }

  // Not running in Docker
  return null;
}

/**
 * Check if the given container ID or name refers to the current container
 */
export async function isSelfContainer(containerIdOrName: string): Promise<boolean> {
  const selfId = await getSelfContainerId();

  if (!selfId) {
    // Not running in Docker, so no container can be "self"
    return false;
  }

  // Check if the given ID/name matches our container ID
  // Handle both full ID and short ID
  if (containerIdOrName === selfId || selfId.startsWith(containerIdOrName)) {
    return true;
  }

  // Also check if it's our container name
  try {
    const inspect = await dockerJsonRequest<{ Id: string; Name: string }>({
      path: `/containers/${encodeURIComponent(containerIdOrName)}/json`,
      method: 'GET'
    });

    return inspect.Id === selfId || selfId.startsWith(inspect.Id) || inspect.Id.startsWith(selfId);
  } catch {
    // Container not found or error inspecting
    return false;
  }
}

/**
 * Get information about whether we're running in Docker
 */
export async function getSelfContainerInfo(): Promise<{
  inContainer: boolean;
  containerId: string | null;
  shortId: string | null;
}> {
  const containerId = await getSelfContainerId();

  return {
    inContainer: containerId !== null,
    containerId,
    shortId: containerId ? containerId.substring(0, 12) : null
  };
}
