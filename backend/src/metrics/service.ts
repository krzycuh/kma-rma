import { LocalMetricsCollector, MetricsSnapshot } from './collector';
import { METRICS_HISTORY_SIZE, METRICS_POLL_INTERVAL_MS } from '../config';

export class MetricsService {
  private buffer: MetricsSnapshot[] = [];
  private collector: LocalMetricsCollector;

  constructor(
    private readonly pollIntervalMs: number = METRICS_POLL_INTERVAL_MS,
    private readonly maxHistory: number = METRICS_HISTORY_SIZE
  ) {
    this.collector = new LocalMetricsCollector(this.pollIntervalMs, (sample) => this.pushSample(sample));
  }

  start(): void {
    this.collector.start();
  }

  stop(): void {
    this.collector.stop();
  }

  getLatest(): MetricsSnapshot | null {
    if (this.buffer.length === 0) return null;
    return this.buffer[this.buffer.length - 1];
  }

  getHistory(limit?: number): MetricsSnapshot[] {
    const effLimit = Math.max(1, Math.min(limit ?? this.maxHistory, this.maxHistory));
    return this.buffer.slice(-effLimit);
  }

  private pushSample(sample: MetricsSnapshot): void {
    this.buffer.push(sample);
    if (this.buffer.length > this.maxHistory) {
      this.buffer.splice(0, this.buffer.length - this.maxHistory);
    }
  }
}


