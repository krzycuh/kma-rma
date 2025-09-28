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
    <Box className="min-h-screen p-6 bg-gradient-to-b from-indigo-50 via-purple-50 to-white">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <Typography variant="h3" className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600">Raspberry Pi Manager</Typography>
          <Typography variant="body2" className="text-gray-500">Zalogowany jako {user}</Typography>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 items-stretch">
          <div className="h-full">
          <Card className="h-full rounded-2xl shadow-xl border border-purple-100/60 bg-white/80 backdrop-blur-sm">
            <CardContent className="h-full flex flex-col gap-2">
              <Typography variant="subtitle2">CPU</Typography>
              <Typography variant="h5">
                {snapshot?.cpu?.usagePercent != null ? `${snapshot.cpu.usagePercent.toFixed(1)}%` : '—'}
                <span className="text-sm text-gray-500 ml-3">{snapshot?.cpu?.temperatureC != null ? `${snapshot.cpu.temperatureC.toFixed(1)}°C` : ''}</span>
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
                {snapshot?.memory ? `${(snapshot.memory.usedKB/1024).toFixed(0)} MB / ${(snapshot.memory.memTotalKB/1024).toFixed(0)} MB` : '—'}
              </Typography>
              <div className="mt-auto">
                <Sparkline values={ramSeries} />
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    </Box>
  );
}

export default App;


