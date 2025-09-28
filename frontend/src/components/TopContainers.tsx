import { useEffect, useState } from 'react';

type Container = {
  id: string;
  name: string;
  cpuPercent: number;
  memPercent: number;
  memMB: number;
};

export default function TopContainers({ token }: { token: string }) {
  const [list, setList] = useState<Container[]>([]);

  useEffect(() => {
    let mounted = true;
    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/containers?token=${token}`);
        if (res.ok) {
          const data = (await res.json()) as Container[];
          if (mounted) setList(data);
        }
      } catch {
        // ignore
      }
    };
    void fetchStats();
    const id = setInterval(fetchStats, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, [token]);

  return (
    <div className="text-sm">
      <div className="grid grid-cols-8 text-gray-500">
        <div className="col-span-3">Container</div>
        <div className="text-right">CPU%</div>
        <div className="text-right">Mem%</div>
        <div className="text-right col-span-2">Mem</div>
      </div>
      <div className="divide-y divide-purple-100/60">
        {list.map(c => (
          <div key={c.id} className="grid grid-cols-8 py-1">
            <div className="col-span-3 truncate" title={`${c.name} (${c.id.slice(0, 12)})`}>{c.name}</div>
            <div className="text-right">{c.cpuPercent.toFixed(1)}</div>
            <div className="text-right">{c.memPercent.toFixed(1)}</div>
            <div className="text-right col-span-2">{Math.round(c.memMB)} MB</div>
          </div>
        ))}
        {list.length === 0 && <div className="text-gray-400 py-2">No containers or Docker stats disabled</div>}
      </div>
    </div>
  );
}


