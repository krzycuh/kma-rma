import { ServerResponse } from 'http';
import { SSEEventPayload, sendSSEEvent, sendHeartbeat } from './events';

/**
 * Represents an active SSE client connection
 */
type SSEClient = {
  id: string;
  user: string;
  response: ServerResponse;
  connectedAt: number;
};

type ClientChangeCallback = (clientCount: number) => void;

/**
 * Manages all active SSE connections
 */
export class StreamManager {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private nextClientId = 1;
  private onClientChangeCallbacks: ClientChangeCallback[] = [];

  /**
   * Start the stream manager and begin heartbeat
   */
  start(): void {
    if (this.heartbeatInterval) return;

    // Send heartbeat every 30 seconds to keep connections alive
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeatToAll();
    }, 30000);
  }

  /**
   * Stop the stream manager and cleanup
   */
  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all connections
    this.clients.forEach((client) => {
      client.response.end();
    });
    this.clients.clear();
  }

  /**
   * Register a new SSE client
   */
  addClient(user: string, response: ServerResponse): string {
    const id = `client-${this.nextClientId++}`;

    // Set SSE headers
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    // Send initial comment to establish connection
    response.write(': stream-start\n\n');

    const client: SSEClient = {
      id,
      user,
      response,
      connectedAt: Date.now()
    };

    this.clients.set(id, client);
    this.notifyClientChange();

    // Handle client disconnect
    response.on('close', () => {
      this.removeClient(id);
    });

    return id;
  }

  /**
   * Remove a client from the manager
   */
  removeClient(id: string): void {
    const client = this.clients.get(id);
    if (client) {
      try {
        client.response.end();
      } catch {
        // Ignore errors when closing
      }
      this.clients.delete(id);
      this.notifyClientChange();
    }
  }

  /**
   * Broadcast an event to all connected clients
   */
  broadcast(payload: SSEEventPayload): void {
    const deadClients: string[] = [];

    this.clients.forEach((client, id) => {
      const success = sendSSEEvent(client.response, payload);
      if (!success) {
        deadClients.push(id);
      }
    });

    // Clean up dead connections
    deadClients.forEach((id) => this.removeClient(id));
  }

  /**
   * Send heartbeat to all clients
   */
  private sendHeartbeatToAll(): void {
    const deadClients: string[] = [];

    this.clients.forEach((client, id) => {
      const success = sendHeartbeat(client.response);
      if (!success) {
        deadClients.push(id);
      }
    });

    // Clean up dead connections
    deadClients.forEach((id) => this.removeClient(id));
  }

  /**
   * Get count of active clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get all client IDs
   */
  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Register a callback to be notified when client count changes
   */
  onClientChange(callback: ClientChangeCallback): void {
    this.onClientChangeCallbacks.push(callback);
  }

  /**
   * Notify all registered callbacks about client count change
   */
  private notifyClientChange(): void {
    const count = this.clients.size;
    this.onClientChangeCallbacks.forEach(cb => cb(count));
  }
}

// Singleton instance
export const streamManager = new StreamManager();
