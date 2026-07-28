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

type UpdateStatusResponse = {
  requestId: string;
  container: string;
  state: 'pulling' | 'up-to-date' | 'restarting' | 'verifying' | 'done' | 'rolled-back' | 'failed';
  message?: string;
  logs?: string[];
};

type UpdateState = {
  state: 'idle' | 'loading' | 'success' | 'upToDate' | 'error' | 'scheduled';
  message?: string;
  logs?: string[];
};

const TERMINAL_STATES = ['up-to-date', 'done', 'rolled-back', 'failed'];
const POLL_INTERVAL_MS = 2000;
// Self-update restarts this very app, so status polls fail while it is down.
// Keep polling through errors until this deadline before giving up.
const POLL_DEADLINE_MS = 180000;

function toUpdateState(status: UpdateStatusResponse): UpdateState {
  const logs = status.logs?.slice(-5);
  switch (status.state) {
    case 'done':
      return { state: 'success', message: status.message ?? 'Container updated.', logs };
    case 'up-to-date':
      return { state: 'upToDate', message: status.message ?? 'Image already up to date.', logs };
    case 'rolled-back':
    case 'failed':
      return { state: 'error', message: status.message ?? 'Update failed.', logs };
    default:
      return { state: 'loading', message: status.message ?? 'Updating…', logs };
  }
}

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
    const setUpdate = (state: UpdateState) =>
      setUpdates(prev => ({ ...prev, [container.id]: state }));

    setUpdate({ state: 'loading', message: 'Requesting update…' });
    try {
      const response = await fetch(`/api/containers/${container.id}/update?token=${token}`, {
        method: 'POST'
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || `Request failed with status ${response.status}`);
      }
      const initial = JSON.parse(text) as UpdateStatusResponse;
      setUpdate(toUpdateState(initial));
      if (TERMINAL_STATES.includes(initial.state)) return;

      // Poll the container-manager (via this backend) until a terminal state.
      const deadline = Date.now() + POLL_DEADLINE_MS;
      let offlineSince: number | null = null;
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        try {
          const res = await fetch(
            `/api/containers/update-status/${initial.requestId}?token=${token}`
          );
          if (!res.ok) {
            throw new Error(`Status request failed with ${res.status}`);
          }
          offlineSince = null;
          const status = await res.json() as UpdateStatusResponse;
          setUpdate(toUpdateState(status));
          if (TERMINAL_STATES.includes(status.state)) return;
        } catch {
          // Expected during a self-update: this app is restarting. Keep polling.
          offlineSince = offlineSince ?? Date.now();
          setUpdate({
            state: 'loading',
            message: 'App is restarting, waiting for it to come back…'
          });
        }
      }
      setUpdate({
        state: 'error',
        message: offlineSince
          ? 'Timed out waiting for the app to come back. Refresh the page to check the result.'
          : 'Timed out waiting for the update to finish.'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error while updating container';
      setUpdate({ state: 'error', message });
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
                            : updates[c.id].state === 'scheduled'
                              ? 'text-xs text-orange-600 mb-2'
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
