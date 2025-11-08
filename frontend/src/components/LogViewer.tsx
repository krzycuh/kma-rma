import { useEffect, useRef, useState } from 'react';

type LogViewerProps = {
  url: string;
  maxLines?: number;
};

export default function LogViewer({ url, maxLines = 500 }: LogViewerProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('connecting');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLines([]);
    setStatus('connecting');
    let cancelled = false;
    const source = new EventSource(url);

    source.addEventListener('open', () => {
      if (cancelled) return;
      setStatus('open');
    });

    source.addEventListener('message', (event) => {
      if (cancelled) return;
      const payload = event.data ?? '';
      if (!payload) return;
      setLines((prev) => {
        const next = [...prev, payload];
        if (next.length > maxLines) {
          next.splice(0, next.length - maxLines);
        }
        return next;
      });
    });

    source.addEventListener('end', () => {
      if (cancelled) return;
      setStatus('closed');
      source.close();
    });

    source.addEventListener('error', (event) => {
      if (cancelled) return;
      setStatus('error');
      const message = (event as MessageEvent).data || 'stream error';
      setLines((prev) => [...prev, `⚠️ ${message}`]);
      source.close();
    });

    return () => {
      cancelled = true;
      source.close();
    };
  }, [url, maxLines]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div className="bg-black text-green-300 text-xs font-mono rounded p-2 max-h-64 overflow-y-auto">
      <div className="text-[10px] text-gray-400 mb-1">
        {status === 'connecting' && 'Connecting…'}
        {status === 'open' && 'Live'}
        {status === 'closed' && 'Stream closed'}
        {status === 'error' && 'Stream error'}
      </div>
      {lines.length === 0 && <div className="text-gray-500">No logs yet.</div>}
      {lines.map((line, idx) => (
        <div key={`${idx}-${line.slice(0, 12)}`} className="whitespace-pre-wrap break-words">
          {line}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

