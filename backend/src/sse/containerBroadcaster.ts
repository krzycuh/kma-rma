import { getContainersStats } from '../metrics/dockerStats';
import { streamManager } from './streamManager';
import { SSEEventType } from './events';
import { ENABLE_DOCKER_STATS } from '../config';

/**
 * Broadcast container stats to all SSE clients
 */
export async function broadcastContainerStats(): Promise<void> {
  if (!ENABLE_DOCKER_STATS) {
    return;
  }

  try {
    const containers = await getContainersStats();
    streamManager.broadcast({
      type: SSEEventType.CONTAINERS,
      data: containers
    });
  } catch {
    // Ignore errors in broadcasting
  }
}

let containerPollInterval: NodeJS.Timeout | null = null;

/**
 * Start polling and broadcasting container stats
 */
export function startContainerBroadcast(intervalMs: number = 5000): void {
  if (containerPollInterval) return;

  // Initial broadcast
  void broadcastContainerStats();

  // Set up interval
  containerPollInterval = setInterval(() => {
    void broadcastContainerStats();
  }, intervalMs);
}

/**
 * Stop polling and broadcasting container stats
 */
export function stopContainerBroadcast(): void {
  if (containerPollInterval) {
    clearInterval(containerPollInterval);
    containerPollInterval = null;
  }
}
