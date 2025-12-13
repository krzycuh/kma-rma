import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import Sparkline from './components/Sparkline';
import TopContainers from './components/TopContainers';
import { SSEProvider, useSSE, type MetricsSnapshot } from './context/SSEContext';

function Dashboard() {
  const { latestMetrics } = useSSE();
  const [samples, setSamples] = useState<MetricsSnapshot[]>([]);

  // Add latest metrics to samples history
  useEffect(() => {
    if (!latestMetrics) return;

    setSamples((prev) => {
      const next = [...prev, latestMetrics];
      if (next.length > 60) {
        next.splice(0, next.length - 60);
      }
      return next;
    });
  }, [latestMetrics]);

  const cpuSeries = useMemo(() => samples.map(p => Math.max(0, Math.min(100, p.cpu?.usagePercent ?? 0))), [samples]);
  const ramSeries = useMemo(() => samples.map(p => {
    const total = (p.memory?.memTotalKB ?? 0);
    const used = (p.memory?.usedKB ?? 0);
    return total > 0 ? (used / total) * 100 : 0;
  }), [samples]);

  const downloadSeries = useMemo(() =>
    samples.map(s => (s.network?.totalRxBytesPerSec ?? 0) / 1024 / 1024)
  , [samples]);

  const uploadSeries = useMemo(() =>
    samples.map(s => (s.network?.totalTxBytesPerSec ?? 0) / 1024 / 1024)
  , [samples]);

  const formatBytesPerSec = (bytesPerSec: number | null | undefined): string => {
    if (bytesPerSec == null) return '—';

    const abs = Math.abs(bytesPerSec);
    if (abs < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
    if (abs < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSec / 1024 / 1024).toFixed(2)} MB/s`;
  };

  return (
    <Box className="min-h-screen p-6 bg-gradient-to-b from-indigo-50 via-purple-50 to-white">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <Typography variant="h3" className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600">Raspberry Pi Manager</Typography>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          <div className="h-full">
          <Card className="h-full rounded-2xl shadow-xl border border-purple-100/60 bg-white/80 backdrop-blur-sm">
            <CardContent className="h-full flex flex-col gap-2">
              <Typography variant="subtitle2">CPU</Typography>
              <Typography variant="h5">
                {latestMetrics?.cpu?.usagePercent != null ? `${latestMetrics.cpu.usagePercent.toFixed(1)}%` : '—'}
                <span className="text-sm text-gray-500 ml-3">{latestMetrics?.cpu?.temperatureC != null ? `${latestMetrics.cpu.temperatureC.toFixed(1)}°C` : ''}</span>
              </Typography>
              <div className="mt-auto">
                <Sparkline values={cpuSeries} />
              </div>
            </CardContent>
          </Card>
          </div>
          <div className="h-full">
          <Card className="h-full rounded-2xl shadow-xl border border-purple-100/60 bg-white/80 backdrop-blur-sm">
            <CardContent className="h-full flex flex-col gap-2">
              <Typography variant="subtitle2">RAM Used</Typography>
              <Typography variant="h5">
                {latestMetrics?.memory ? `${(latestMetrics.memory.usedKB/1024).toFixed(0)} MB / ${(latestMetrics.memory.memTotalKB/1024).toFixed(0)} MB` : '—'}
              </Typography>
              <div className="mt-auto">
                <Sparkline values={ramSeries} />
              </div>
            </CardContent>
          </Card>
          </div>
          <div className="h-full">
          <Card className="h-full rounded-2xl shadow-xl border border-purple-100/60 bg-white/80 backdrop-blur-sm">
            <CardContent className="h-full flex flex-col gap-2">
              <Typography variant="subtitle2">Network</Typography>
              <Typography variant="h6" className="text-blue-600">
                ↓ {formatBytesPerSec(latestMetrics?.network?.totalRxBytesPerSec)}
              </Typography>
              <Typography variant="h6" className="text-green-600">
                ↑ {formatBytesPerSec(latestMetrics?.network?.totalTxBytesPerSec)}
              </Typography>
              <div className="mt-auto space-y-1">
                <div className="text-xs text-gray-500">Download</div>
                <Sparkline values={downloadSeries} />
                <div className="text-xs text-gray-500">Upload</div>
                <Sparkline values={uploadSeries} />
              </div>
            </CardContent>
          </Card>
          </div>
          <div className="h-full md:col-span-3">
          <Card className="h-full rounded-2xl shadow-xl border border-purple-100/60 bg-white/80 backdrop-blur-sm">
            <CardContent className="h-full flex flex-col gap-2">
              <Typography variant="subtitle2">Containers</Typography>
              <TopContainers />
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    </Box>
  );
}

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    setToken(urlToken);
    if (urlToken) {
      void checkAuth(urlToken);
    }
  }, []);

  const checkAuth = async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/user?token=${t}`);
      if (!res.ok) throw new Error('Unauthorized');
      const data = await res.json();
      setUser(data.name ?? 'User');
    } catch {
      setError('Authorization failed. Check token.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box className="min-h-screen flex items-center justify-center bg-gradient-to-b from-indigo-50 via-purple-50 to-white">
        <Typography className="text-gray-600">Loading…</Typography>
      </Box>
    );
  }

  if (!token || !user) {
    return (
      <Box className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-indigo-50 via-purple-50 to-white">
        <Box className="w-full max-w-md space-y-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-purple-100 p-6">
          <Typography variant="h4" className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600">Raspberry Pi Manager</Typography>
          <Typography variant="body2" className="text-gray-500">Podaj token, aby przejść dalej</Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField fullWidth label="Token" onChange={(e) => setToken(e.target.value)} />
          <Button variant="contained" onClick={() => token && checkAuth(token)} className="!bg-gradient-to-r !from-violet-600 !to-indigo-600 !text-white" disableElevation>
            Zaloguj
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <SSEProvider token={token}>
      <Dashboard />
    </SSEProvider>
  );
}

export default App;
