import { ClockHz, MemoryAmount, TemperatureCelsius } from './types';

export function parseVcgencmdMeasureTemp(output: string): TemperatureCelsius | null {
  // Example: temp=48.3'C
  const m = output.match(/temp=([0-9]+(?:\.[0-9]+)?)'C/);
  if (!m) return null;
  return { celsius: Number.parseFloat(m[1]) };
}

export function parseVcgencmdMeasureClock(output: string): ClockHz | null {
  // Example: frequency(48)=1500398464
  const m = output.match(/frequency\(\d+\)=(\d+)/);
  if (!m) return null;
  return { hertz: Number.parseInt(m[1], 10) };
}

export function parseVcgencmdGetMemGpu(output: string): MemoryAmount | null {
  // Example: gpu=76M
  const m = output.match(/gpu=(\d+)([KMG])/i);
  if (!m) return null;
  const value = Number.parseInt(m[1], 10);
  const unit = m[2].toUpperCase();
  let bytes = value;
  if (unit === 'K') bytes = value * 1024;
  if (unit === 'M') bytes = value * 1024 * 1024;
  if (unit === 'G') bytes = value * 1024 * 1024 * 1024;
  return { bytes, megabytes: bytes / (1024 * 1024) };
}


