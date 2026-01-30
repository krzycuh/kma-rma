import { Box, Chip, Typography } from '@mui/material';
import SimCardIcon from '@mui/icons-material/SimCard';
import PublicIcon from '@mui/icons-material/Public';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RouterIcon from '@mui/icons-material/Router';
import { formatUptime } from '../../utils/formatBytes';
import type { ConnectionInfo, SimStatus, RouterSystemInfo } from '../../types/router';

interface StatusBarProps {
  connection: ConnectionInfo | null;
  sim: SimStatus | null;
  system: RouterSystemInfo | null;
  lastUpdated: number | null;
  error: string | null;
}

export default function StatusBar({ connection, sim, system, lastUpdated, error }: StatusBarProps) {
  const getStaleIndicator = () => {
    if (!lastUpdated) return null;
    const age = (Date.now() - lastUpdated) / 1000;
    if (age > 30) {
      return (
        <Chip
          label={`Stale data (${Math.round(age)}s ago)`}
          size="small"
          color="warning"
          variant="outlined"
        />
      );
    }
    return null;
  };

  if (error) {
    return (
      <Box className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-center justify-between">
        <Typography variant="body2" color="error">
          Router error: {error}
        </Typography>
        {getStaleIndicator()}
      </Box>
    );
  }

  if (!connection && !sim && !system) {
    return (
      <Box className="rounded-xl bg-gray-50 border border-gray-200 p-3">
        <Typography variant="body2" color="text.secondary">
          Waiting for router data...
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="rounded-xl bg-gray-50 border border-gray-200 p-3 flex flex-wrap items-center gap-4">
      {sim && (
        <Box className="flex items-center gap-1">
          <SimCardIcon fontSize="small" className={sim.isOk ? 'text-green-500' : 'text-red-500'} />
          <Typography variant="body2">
            SIM: {sim.isOk ? 'OK' : sim.statusText}
          </Typography>
        </Box>
      )}

      {connection?.ispName && (
        <Box className="flex items-center gap-1">
          <RouterIcon fontSize="small" className="text-gray-500" />
          <Typography variant="body2">
            {connection.ispName}
          </Typography>
        </Box>
      )}

      {connection?.wanIp && (
        <Box className="flex items-center gap-1">
          <PublicIcon fontSize="small" className="text-gray-500" />
          <Typography variant="body2">
            {connection.wanIp}
          </Typography>
        </Box>
      )}

      {connection && connection.uptimeSeconds > 0 && (
        <Box className="flex items-center gap-1">
          <AccessTimeIcon fontSize="small" className="text-gray-500" />
          <Typography variant="body2">
            Uptime: {formatUptime(connection.uptimeSeconds)}
          </Typography>
        </Box>
      )}

      {system?.model && (
        <Box className="flex items-center gap-1 ml-auto">
          <Typography variant="caption" color="text.secondary">
            {system.model} {system.firmwareVersion && `(${system.firmwareVersion})`}
          </Typography>
        </Box>
      )}

      {getStaleIndicator()}
    </Box>
  );
}
