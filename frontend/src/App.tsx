import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import Sparkline from './components/Sparkline';

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [samples, setSamples] = useState<any[]>([]);

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

  useEffect(() => {
    if (!user || !token) return;
    void loadData();
    const id = setInterval(() => void loadData(), 3001);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  const loadData = async () => {
    try {
      const [sRes, hRes] = await Promise.all([
        fetch(`/api/metrics?token=${token}`),
        fetch(`/api/history?limit=60&token=${token}`)
      ]);
      if (sRes.ok) setSnapshot(await sRes.json());
      if (hRes.ok) setSamples(await hRes.json());
    } catch {
      // ignore fetch errors in UI, user stays signed in
    }
  };

  const cpuSeries = useMemo(() => samples.map(p => Math.max(0, Math.min(100, p.cpu?.usagePercent ?? 0))), [samples]);
  const ramSeries = useMemo(() => samples.map(p => {
    const total = (p.memory?.memTotalKB ?? 0);
    const used = (p.memory?.usedKB ?? 0);
    return total > 0 ? (used / total) * 100 : 0;
  }), [samples]);

  if (loading) {
    return (
      <Box className="min-h-screen flex items-center justify-center">
        <Typography>Loading…</Typography>
      </Box>
    );
  }

  if (!token || !user) {
    return (
      <Box className="min-h-screen flex items-center justify-center p-4">
        <Box className="w-full max-w-md space-y-4">
          <Typography variant="h5">Enter token</Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField fullWidth label="Token" onChange={(e) => setToken(e.target.value)} />
          <Button variant="contained" onClick={() => token && checkAuth(token)}>Sign in</Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="min-h-screen p-6 space-y-4">
      <Typography variant="h5">Raspberry Pi Metrics</Typography>
      <Typography variant="body2" className="text-gray-500">Signed in as {user}</Typography>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <Card>
            <CardContent>
              <Typography variant="subtitle2">CPU Usage</Typography>
              <Typography variant="h5">{snapshot?.cpu?.usagePercent != null ? `${snapshot.cpu.usagePercent.toFixed(1)}%` : '—'}</Typography>
              <Sparkline values={cpuSeries} />
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardContent>
              <Typography variant="subtitle2">CPU Temp</Typography>
              <Typography variant="h5">{snapshot?.cpu?.temperatureC != null ? `${snapshot.cpu.temperatureC.toFixed(1)}°C` : '—'}</Typography>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardContent>
              <Typography variant="subtitle2">CPU Clock</Typography>
              <Typography variant="h5">{snapshot?.cpu?.clockHz != null ? `${(snapshot.cpu.clockHz/1e6).toFixed(0)} MHz` : '—'}</Typography>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardContent>
              <Typography variant="subtitle2">RAM Used</Typography>
              <Typography variant="h5">
                {snapshot?.memory ? `${(snapshot.memory.usedKB/1024).toFixed(0)} MB / ${(snapshot.memory.memTotalKB/1024).toFixed(0)} MB` : '—'}
              </Typography>
              <Sparkline values={ramSeries} />
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardContent>
              <Typography variant="subtitle2">GPU Temp</Typography>
              <Typography variant="h5">{snapshot?.gpu?.temperatureC != null ? `${snapshot.gpu.temperatureC.toFixed(1)}°C` : '—'}</Typography>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardContent>
              <Typography variant="subtitle2">GPU Memory</Typography>
              <Typography variant="h5">{snapshot?.gpu?.memoryMB != null ? `${snapshot.gpu.memoryMB} MB` : '—'}</Typography>
            </CardContent>
          </Card>
        </div>
      </div>
    </Box>
  );
}

export default App;


