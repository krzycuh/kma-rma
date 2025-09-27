import { useEffect, useState } from 'react';
import { Alert, Box, Button, TextField, Typography } from '@mui/material';

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
    <Box className="min-h-screen p-6">
      <Typography variant="h5" className="mb-4">Hello, {user}</Typography>
      <Typography>Replace this page with your feature UI.</Typography>
    </Box>
  );
}

export default App;


