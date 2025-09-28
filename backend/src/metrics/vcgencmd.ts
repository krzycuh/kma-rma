import { TemperatureCelsius } from './types';

export function parseVcgencmdMeasureTemp(output: string): TemperatureCelsius | null {
  // Example: temp=48.3'C
  const m = output.match(/temp=([0-9]+(?:\.[0-9]+)?)'C/);
  if (!m) return null;
  return { celsius: Number.parseFloat(m[1]) };
}

// Removed measure_clock and get_mem gpu parsing as they are no longer used


