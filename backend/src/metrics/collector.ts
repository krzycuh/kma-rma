import { promises as fs } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { computeCpuUsagePercent, parseProcMeminfo, parseProcStat, parseVcgencmdMeasureTemp } from './index';
import { CpuTimes, MemoryStats, TemperatureCelsius } from './types';

const execFileAsync = promisify(execFile);

export type MetricsSnapshot = {
  ts: number;
  cpu: {
    usagePercent: number | null;
    temperatureC: number | null;
  };
  memory: MemoryStats;
};

async function readTextFile(path: string): Promise<string | null> {
  try {
    return await fs.readFile(path, 'utf8');
  } catch {
    return null;
  }
}

async function readProcStat(): Promise<CpuTimes | null> {
  const content = await readTextFile('/proc/stat');
  if (!content) return null;
  return parseProcStat(content);
}

async function readProcMeminfo(): Promise<MemoryStats | null> {
  const content = await readTextFile('/proc/meminfo');
  if (!content) return null;
  return parseProcMeminfo(content);
}

async function readThermalZone0Temp(): Promise<TemperatureCelsius | null> {
  const content = await readTextFile('/sys/class/thermal/thermal_zone0/temp');
  if (!content) return null;
  const raw = content.trim();
  const milli = Number.parseInt(raw, 10);
  if (Number.isNaN(milli)) return null;
  return { celsius: milli / 1000 };
}

async function runVcgencmd(args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('vcgencmd', args, { timeout: 2000 });
    return stdout.trim();
  } catch {
    return null;
  }
}

async function readCpuTemp(): Promise<TemperatureCelsius | null> {
  const out = await runVcgencmd(['measure_temp']);
  if (out) {
    const parsed = parseVcgencmdMeasureTemp(out);
    if (parsed) return parsed;
  }
  return readThermalZone0Temp();
}



export class LocalMetricsCollector {
  private timer: NodeJS.Timeout | null = null;
  private prevCpuTimes: CpuTimes | null = null;

  constructor(
    private readonly pollIntervalMs: number,
    private readonly onSample: (sample: MetricsSnapshot) => void
  ) {}

  start(): void {
    if (this.timer) return;
    void this.pollOnce();
    this.timer = setInterval(() => {
      void this.pollOnce();
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async pollOnce(): Promise<void> {
    const [cpuTimes, mem, cpuTemp] = await Promise.all([
      readProcStat(),
      readProcMeminfo(),
      readCpuTemp()
    ]);

    const usagePercent = this.computeUsage(cpuTimes);

    const memory: MemoryStats = mem || {
      memTotalKB: 0,
      memFreeKB: 0,
      memAvailableKB: null,
      buffersKB: 0,
      cachedKB: 0,
      sReclaimableKB: 0,
      usedKB: 0,
      usedPercent: 0
    };

    const snapshot: MetricsSnapshot = {
      ts: Date.now(),
      cpu: {
        usagePercent,
        temperatureC: cpuTemp?.celsius ?? null
      },
      memory
    };

    try {
      this.onSample(snapshot);
    } catch {
      // swallow callback errors to avoid breaking polling loop
    }
  }

  private computeUsage(curr: CpuTimes | null): number | null {
    if (!curr) return null;
    if (!this.prevCpuTimes) {
      this.prevCpuTimes = curr;
      return null;
    }
    const usage = computeCpuUsagePercent(this.prevCpuTimes, curr);
    this.prevCpuTimes = curr;
    return Number.isFinite(usage.percent) ? usage.percent : 0;
  }
}


