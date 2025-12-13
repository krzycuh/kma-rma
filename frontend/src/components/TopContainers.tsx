import { useCallback, useMemo, useState } from 'react';
import LogViewer from './LogViewer';
import { useSSE } from '../context/SSEContext';

type Container = {
  id: string;
  name: string;
  cpuPercent: number;
  memPercent: number;
  memMB: number;
};

type ContainerUpdateResponse = {
  containerId: string;
  containerName: string;
  image: string;
  message: string;
  imageUpdated: boolean;
  logs?: string[];
};

type UpdateState = {
  state: 'idle' | 'loading' | 'success' | 'upToDate' | 'error';
  message?: string;
  logs?: string[];
};

export default function TopContainers() {
  const { containers, token } = useSSE();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tail, setTail] = useState<number>(200);
  const [updates, setUpdates] = useState<Record<string, UpdateState>>({});

  const sorted = useMemo(() => {
    const copy = [...containers];
    copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  }, [containers]);

  const triggerUpdate = useCallback(async (container: Container) => {
    if (!token) return;
    setUpdates(prev => ({
      ...prev,
      [container.id]: { state: 'loading', message: 'Checking for new image…' }
    }));
    try {
      const response = await fetch(`/api/containers/${container.id}/update?token=${token}`, {
        method: 'POST'
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || `Request failed with status ${response.status}`);
      }
      let payload: ContainerUpdateResponse | null = null;
      try {
        payload = JSON.parse(text) as ContainerUpdateResponse;
      } catch {
        // keep payload null if parsing fails
      }
      const message =
        payload?.message ??
        (payload?.imageUpdated ? 'Container recreated with latest image.' : 'Image already up to date.');
      setUpdates(prev => ({
        ...prev,
        [container.id]: {
          state: payload?.imageUpdated ? 'success' : 'upToDate',
          message,
          logs: payload?.logs?.slice(0, 5)
        }
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error while updating container';
      setUpdates(prev => ({
        ...prev,
        [container.id]: { state: 'error', message }
      }));
    }
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
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="text-gray-600 text-xs">Logs: {c.name}</div>
                    <div className="flex items-center gap-3 text-xs">
                      <button
                        className="rounded bg-indigo-600 text-white px-2 py-1 hover:bg-indigo-500 disabled:bg-indigo-300"
                        onClick={() => triggerUpdate(c)}
                        disabled={updates[c.id]?.state === 'loading'}
                      >
                        {updates[c.id]?.state === 'loading' ? 'Updating…' : 'Pull & restart'}
                      </button>
                      <label className="flex items-center gap-1">
                        <span>Tail:</span>
                        <select className="border rounded px-1 py-0.5" value={tail} onChange={(e) => setTail(parseInt(e.target.value, 10))}>
                          <option value={100}>100</option>
                          <option value={200}>200</option>
                          <option value={500}>500</option>
                          <option value={1000}>1000</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  {updates[c.id] && updates[c.id].state !== 'idle' && (
                    <div
                      className={
                        updates[c.id].state === 'error'
                          ? 'text-xs text-red-600 mb-2'
                          : updates[c.id].state === 'success'
                            ? 'text-xs text-green-600 mb-2'
                            : 'text-xs text-gray-600 mb-2'
                      }
                    >
                      {updates[c.id]?.message}
                      {updates[c.id]?.logs && updates[c.id]!.logs!.length > 0 && (
                        <div className="mt-1 space-y-0.5 text-[11px] text-gray-500">
                          {updates[c.id]!.logs!.map((log, idx) => (
                            <div key={idx} className="truncate">
                              {log}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
