import { MetricsSnapshot } from '../metrics/collector';
import { RouterResult } from '../router/types';

/**
 * Event types for SSE stream
 */
export enum SSEEventType {
  METRICS = 'metrics',
  CONTAINERS = 'containers',
  CONTAINER_LOG = 'container-log',
  ROUTER = 'router',
  HEARTBEAT = 'heartbeat',
  ERROR = 'error'
}

/**
 * Container stats data structure
 */
export type ContainerStats = {
  id: string;
  name: string;
  cpuPercent: number;
  memPercent: number;
  memMB: number;
};

/**
 * Container log event data
 */
export type ContainerLogEvent = {
  id: string;
  line: string;
};

/**
 * SSE event payload types
 */
export type SSEEventPayload =
  | { type: SSEEventType.METRICS; data: MetricsSnapshot }
  | { type: SSEEventType.CONTAINERS; data: ContainerStats[] }
  | { type: SSEEventType.CONTAINER_LOG; data: ContainerLogEvent }
  | { type: SSEEventType.ROUTER; data: RouterResult }
  | { type: SSEEventType.HEARTBEAT; data: { ts: number } }
  | { type: SSEEventType.ERROR; data: { message: string } };

/**
 * Formats data as SSE message
 */
export function formatSSE(event: string, data: unknown): string {
  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
  return `event: ${event}\ndata: ${dataStr}\n\n`;
}

/**
 * Sends an SSE event with proper formatting
 */
export function sendSSEEvent(
  res: NodeJS.WritableStream,
  payload: SSEEventPayload
): boolean {
  try {
    const message = formatSSE(payload.type, payload.data);
    return res.write(message);
  } catch {
    return false;
  }
}

/**
 * Sends a heartbeat event
 */
export function sendHeartbeat(res: NodeJS.WritableStream): boolean {
  return sendSSEEvent(res, {
    type: SSEEventType.HEARTBEAT,
    data: { ts: Date.now() }
  });
}
