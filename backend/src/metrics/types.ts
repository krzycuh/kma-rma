export type CpuTimes = {
  user: number;
  nice: number;
  system: number;
  idle: number;
  iowait: number;
  irq: number;
  softirq: number;
  steal: number;
  guest: number;
  guestNice: number;
};

export type CpuUsage = {
  percent: number;
  totalDelta: number;
  idleDelta: number;
};

export type MemoryStats = {
  memTotalKB: number;
  memFreeKB: number;
  memAvailableKB: number | null;
  buffersKB: number;
  cachedKB: number;
  sReclaimableKB: number;
  usedKB: number;
  usedPercent: number;
};

export type TemperatureCelsius = {
  celsius: number;
};



