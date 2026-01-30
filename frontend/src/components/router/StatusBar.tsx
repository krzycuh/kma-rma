import { Box, Chip, Typography, Alert } from '@mui/material';
import SimCardIcon from '@mui/icons-material/SimCard';
import PublicIcon from '@mui/icons-material/Public';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RouterIcon from '@mui/icons-material/Router';
import WarningIcon from '@mui/icons-material/Warning';
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
  const hasData = connection || sim || system;

  // Show loading state only when we have no data at all
  if (!hasData && !error) {
    return (
      <Box className="rounded-xl bg-gray-50 border border-gray-200 p-3">
        <Typography variant="body2" color="text.secondary">
          Waiting for router data...
        </Typography>
      </Box>
    );
  }

  // Show error without data
  if (!hasData && error) {
    return (
      <Alert severity="error" className="rounded-xl">
        Router error: {error}
      </Alert>
    );
  }

  return (
    <Box className="space-y-2">
      {/* Error banner when we have stale data */}
      {error && (
        <Box className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex items-center gap-2">
          <WarningIcon fontSize="small" className="text-amber-600" />
          <Typography variant="body2" className="text-amber-800">
            Connection issue (showing last known data)
          </Typography>
        </Box>
      )}

      {/* Status data */}
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

        {/* Stale data indicator */}
        {lastUpdated && (Date.now() - lastUpdated) / 1000 > 30 && (
          <Chip
            label={`Updated ${Math.round((Date.now() - lastUpdated) / 1000)}s ago`}
            size="small"
            color="warning"
            variant="outlined"
          />
        )}
      </Box>
    </Box>
  );
}
