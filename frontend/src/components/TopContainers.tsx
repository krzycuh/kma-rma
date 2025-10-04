import { useEffect, useMemo, useState } from 'react';
import LogViewer from './LogViewer';

type Container = {
  id: string;
  name: string;
  cpuPercent: number;
  memPercent: number;
  memMB: number;
};

export default function TopContainers({ token }: { token: string }) {
  const [list, setList] = useState<Container[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tail, setTail] = useState<number>(200);

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

  const sorted = useMemo(() => {
    const copy = [...list];
    copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  }, [list]);

  return (
    <div className="text-sm">
      <div className="grid grid-cols-8 text-gray-500">
        <div className="col-span-3">Container</div>
        <div className="text-right">CPU%</div>
        <div className="text-right">Mem%</div>
        <div className="text-right col-span-2">Mem</div>
      </div>
      <div className="divide-y divide-purple-100/60">
        {sorted.map(c => (
          <div key={c.id}>
            <div className="grid grid-cols-8 py-1 items-center">
              <button className="text-left col-span-3 truncate hover:underline" title={`${c.name} (${c.id.slice(0, 12)})`} onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                {c.name}
              </button>
              <div className="text-right">{c.cpuPercent.toFixed(1)}</div>
              <div className="text-right">{c.memPercent.toFixed(1)}</div>
              <div className="text-right col-span-2">{Math.round(c.memMB)} MB</div>
            </div>
            {expandedId === c.id && (
              <div className="col-span-8 p-2 bg-purple-50/50 rounded-lg border border-purple-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-gray-600 text-xs">Logs: {c.name}</div>
                  <div className="space-x-2 text-xs">
                    <label>Tail: </label>
                    <select className="border rounded px-1 py-0.5" value={tail} onChange={(e) => setTail(parseInt(e.target.value, 10))}>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                      <option value={500}>500</option>
                      <option value={1000}>1000</option>
                    </select>
                  </div>
                </div>
                <LogViewer url={`/api/containers/${c.id}/logs?token=${token}&tail=${tail}&follow=1`} />
              </div>
            )}
          </div>
        ))}
        {sorted.length === 0 && <div className="text-gray-400 py-2">No containers or Docker stats disabled</div>}
      </div>
    </div>
  );
}


