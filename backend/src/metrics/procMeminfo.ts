import { MemoryStats } from './types';

export function parseProcMeminfo(content: string): MemoryStats {
  const lines = content.split('\n');
  const map = new Map<string, number>();
  for (const line of lines) {
    const m = line.match(/^(\w+):\s+(\d+)\s*kB/);
    if (m) {
      const key = m[1];
      const value = Number.parseInt(m[2], 10);
      map.set(key, value);
    }
  }

  const memTotalKB = map.get('MemTotal') || 0;
  const memFreeKB = map.get('MemFree') || 0;
  const buffersKB = map.get('Buffers') || 0;
  const cachedKB = map.get('Cached') || 0;
  const sReclaimableKB = map.get('SReclaimable') || 0;
  const memAvailableKB = map.has('MemAvailable') ? map.get('MemAvailable') || 0 : null;

  const availableKB = memAvailableKB !== null
    ? memAvailableKB
    : memFreeKB + buffersKB + cachedKB + sReclaimableKB;
  const usedKB = Math.max(0, memTotalKB - availableKB);
  const usedPercent = memTotalKB > 0 ? (usedKB / memTotalKB) * 100 : 0;

  return {
    memTotalKB,
    memFreeKB,
    memAvailableKB,
    buffersKB,
    cachedKB,
    sReclaimableKB,
    usedKB,
    usedPercent
  };
}


