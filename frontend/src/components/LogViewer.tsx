/**
 * LogViewer component - displays container logs
 * TODO: Implement actual log streaming with SSE
 */
export default function LogViewer({ url }: { url: string }) {
  return (
    <div className="bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-auto max-h-96">
      <div className="text-gray-500">
        Log streaming not yet implemented for: {url}
      </div>
    </div>
  );
}
