import { CpuTimes, CpuUsage } from './types';

export function parseProcStat(content: string): CpuTimes | null {
  const firstLine = content.split('\n')[0]?.trim();
  if (!firstLine || !firstLine.startsWith('cpu ')) return null;
  const parts = firstLine.split(/\s+/);
  // Expected: cpu user nice system idle iowait irq softirq steal guest guest_nice
  if (parts.length < 11) return null;
  const [_, user, nice, system, idle, iowait, irq, softirq, steal, guest, guestNice] = parts;
  const toNum = (v: string) => Number.parseInt(v, 10) || 0;
  return {
    user: toNum(user),
    nice: toNum(nice),
    system: toNum(system),
    idle: toNum(idle),
    iowait: toNum(iowait),
    irq: toNum(irq),
    softirq: toNum(softirq),
    steal: toNum(steal),
    guest: toNum(guest),
    guestNice: toNum(guestNice)
  };
}

export function computeCpuUsagePercent(prev: CpuTimes, curr: CpuTimes): CpuUsage {
  const prevIdle = prev.idle + prev.iowait;
  const currIdle = curr.idle + curr.iowait;
  const prevNonIdle = prev.user + prev.nice + prev.system + prev.irq + prev.softirq + prev.steal;
  const currNonIdle = curr.user + curr.nice + curr.system + curr.irq + curr.softirq + curr.steal;
  const prevTotal = prevIdle + prevNonIdle;
  const currTotal = currIdle + currNonIdle;
  const totalDelta = Math.max(0, currTotal - prevTotal);
  const idleDelta = Math.max(0, currIdle - prevIdle);
  const usedDelta = Math.max(0, totalDelta - idleDelta);
  const percent = totalDelta > 0 ? (usedDelta / totalDelta) * 100 : 0;
  return { percent, totalDelta, idleDelta };
}


