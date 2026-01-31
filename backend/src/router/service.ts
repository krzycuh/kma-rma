/**
 * Router metrics service - manages collection, caching, and history
 */

import { RouterCollector } from './collector';
import { RouterStatus, RouterResult, RouterConfig } from './types';
import {
  ROUTER_IP,
  ROUTER_USERNAME,
  ROUTER_PASSWORD,
  ROUTER_HTTPS,
  ROUTER_POLL_INTERVAL_MS,
  ROUTER_HISTORY_SIZE
} from '../config';

export class RouterService {
  private collector: RouterCollector;
  private buffer: RouterStatus[] = [];
  private lastResult: RouterResult | null = null;
  private lastError: string | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private onSample: ((result: RouterResult) => void) | null = null;

  private readonly pollIntervalMs: number;
  private readonly maxHistory: number;

  constructor(
    pollIntervalMs: number = ROUTER_POLL_INTERVAL_MS,
    maxHistory: number = ROUTER_HISTORY_SIZE
  ) {
    this.pollIntervalMs = pollIntervalMs;
    this.maxHistory = maxHistory;

    const config: RouterConfig = {
      enabled: true,
      host: ROUTER_IP,
      username: ROUTER_USERNAME,
      password: ROUTER_PASSWORD,
      useHttps: ROUTER_HTTPS,
      pollIntervalMs: this.pollIntervalMs,
      historySize: this.maxHistory
    };

    this.collector = new RouterCollector(config);
  }

  /**
   * Set callback for new samples
   */
  setOnSample(callback: (result: RouterResult) => void): void {
    this.onSample = callback;
  }

  /**
   * Start polling router data
   */
  start(): void {
    if (this.pollInterval) return;

    console.log(
      new Date().toISOString(),
      `RouterService: Starting polling every ${this.pollIntervalMs}ms`
    );

    // Initial poll
    void this.poll();

    // Set up interval
    this.pollInterval = setInterval(() => {
      void this.poll();
    }, this.pollIntervalMs);
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Poll router data
   */
  private async poll(): Promise<void> {
    try {
      const result = await this.collector.collect();
      this.lastResult = result;

      if (result.success) {
        this.lastError = null;
        this.pushSample(result.data);

        // Only notify on success - frontend keeps last good data on errors
        if (this.onSample) {
          this.onSample(result);
        }
      } else {
        this.lastError = result.error;
        console.error(
          new Date().toISOString(),
          `RouterService: Poll failed - ${result.errorCode}: ${result.error}`
        );
        // Don't send anything via SSE on error - frontend preserves last state
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.lastError = errorMessage;
      console.error(
        new Date().toISOString(),
        `RouterService: Unexpected error - ${errorMessage}`
      );
    }
  }

  /**
   * Push a sample to the history buffer
   */
  private pushSample(sample: RouterStatus): void {
    this.buffer.push(sample);
    if (this.buffer.length > this.maxHistory) {
      this.buffer.splice(0, this.buffer.length - this.maxHistory);
    }
  }

  /**
   * Get the latest router status
   */
  getLatest(): RouterStatus | null {
    if (this.buffer.length === 0) return null;
    return this.buffer[this.buffer.length - 1];
  }

  /**
   * Get the last result (success or error)
   */
  getLastResult(): RouterResult | null {
    return this.lastResult;
  }

  /**
   * Get the last error message if any
   */
  getLastError(): string | null {
    return this.lastError;
  }

  /**
   * Get history samples
   */
  getHistory(limit?: number): RouterStatus[] {
    const effLimit = Math.max(1, Math.min(limit ?? this.maxHistory, this.maxHistory));
    return this.buffer.slice(-effLimit);
  }

  /**
   * Check if the service has data
   */
  hasData(): boolean {
    return this.buffer.length > 0;
  }

  /**
   * Get the timestamp of the last successful poll
   */
  getLastUpdated(): number | null {
    const latest = this.getLatest();
    return latest ? latest.timestamp : null;
  }
}
