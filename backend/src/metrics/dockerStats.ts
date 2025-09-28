import http from 'http';
import { DOCKER_SOCK_PATH } from '../config';

export type ContainerStat = {
  id: string;
  name: string;
  cpuPercent: number;
  memPercent: number;
  memMB: number;
};

const agent = new http.Agent({ keepAlive: true });

async function requestDocker(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = (http.request as any)({
      socketPath: DOCKER_SOCK_PATH,
      path,
      method: 'GET',
      agent
    }, (res: any) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        } else {
          reject(new Error(`Docker API ${path} status ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

export async function getContainersStats(): Promise<ContainerStat[]> {
  try {
    const containers = await requestDocker('/containers/json');
    const tasks = (containers as any[]).map(async (c) => {
      const id = c.Id as string;
      const name = (c.Names?.[0] || '').replace(/^\//, '') as string;
      try {
        const stats = await requestDocker(`/containers/${id}/stats?stream=false`);
        const cpu = computeCpuPercent(stats);
        const { memPercent, memMB } = computeMem(stats);
        return { id, name, cpuPercent: cpu, memPercent, memMB } as ContainerStat;
      } catch {
        return { id, name, cpuPercent: 0, memPercent: 0, memMB: 0 } as ContainerStat;
      }
    });
    const results = (await Promise.all(tasks)) as ContainerStat[];
    results.sort((a, b) => b.cpuPercent - a.cpuPercent);
    return results;
  } catch {
    return [];
  }
}

function computeCpuPercent(stats: any): number {
  try {
    const cpuDelta = (stats.cpu_stats?.cpu_usage?.total_usage ?? 0) - (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
    const systemDelta = (stats.cpu_stats?.system_cpu_usage ?? 0) - (stats.precpu_stats?.system_cpu_usage ?? 0);
    const cpus = (stats.cpu_stats?.online_cpus ?? stats.cpu_stats?.cpu_usage?.percpu_usage?.length ?? 1) || 1;
    if (cpuDelta > 0 && systemDelta > 0) {
      return (cpuDelta / systemDelta) * cpus * 100;
    }
  } catch {}
  return 0;
}

function computeMem(stats: any): { memPercent: number; memMB: number } {
  try {
    const mem = stats.memory_stats ?? {};
    const rawUsage = Number(mem.usage || 0);
    const cache = Number(mem.stats?.cache || 0);
    const rss = Number(mem.stats?.rss || 0);
    // Prefer usage without cache; fallback to rss; finally raw usage
    const effectiveUsage = rawUsage > cache ? (rawUsage - cache) : (rss > 0 ? rss : rawUsage);
    const limit = Number(mem.limit || 0);
    const memPercent = limit > 0 ? (effectiveUsage / limit) * 100 : 0;
    const memMB = effectiveUsage / (1024 * 1024);
    return { memPercent, memMB };
  } catch {
    return { memPercent: 0, memMB: 0 };
  }
}


