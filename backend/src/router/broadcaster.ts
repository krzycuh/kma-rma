/**
 * Router stats broadcaster - sends router data to SSE clients
 */

import { RouterService } from './service';
import { streamManager } from '../sse/streamManager';
import { SSEEventType } from '../sse/events';
import { ENABLE_ROUTER_STATS } from '../config';
import { RouterResult } from './types';

let routerService: RouterService | null = null;

/**
 * Initialize and start the router service
 */
export function startRouterBroadcast(pollIntervalMs?: number): void {
  if (!ENABLE_ROUTER_STATS) {
    console.log(new Date().toISOString(), 'RouterBroadcast: Disabled (ENABLE_ROUTER_STATS=false)');
    return;
  }

  if (routerService) {
    console.log(new Date().toISOString(), 'RouterBroadcast: Already running');
    return;
  }

  routerService = new RouterService(pollIntervalMs);

  // Set up broadcast callback
  routerService.setOnSample((result: RouterResult) => {
    broadcastRouterStatus(result);
  });

  routerService.start();
  console.log(new Date().toISOString(), 'RouterBroadcast: Started');
}

/**
 * Stop the router broadcast service
 */
export function stopRouterBroadcast(): void {
  if (routerService) {
    routerService.stop();
    routerService = null;
    console.log(new Date().toISOString(), 'RouterBroadcast: Stopped');
  }
}

/**
 * Broadcast router status to all SSE clients
 */
function broadcastRouterStatus(result: RouterResult): void {
  streamManager.broadcast({
    type: SSEEventType.ROUTER,
    data: result
  });
}

/**
 * Get the router service instance
 */
export function getRouterService(): RouterService | null {
  return routerService;
}

/**
 * Get initial router data for new SSE connections
 */
export async function getInitialRouterData(): Promise<RouterResult | null> {
  if (!ENABLE_ROUTER_STATS || !routerService) {
    return null;
  }

  const lastResult = routerService.getLastResult();
  if (lastResult) {
    return lastResult;
  }

  // If no data yet, return a "loading" state
  return null;
}
