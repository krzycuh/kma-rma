import { Card, CardContent, Typography, Box, LinearProgress, Chip } from '@mui/material';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import Sparkline from '../Sparkline';
import type { LteSignal, RouterStatus } from '../../types/router';

interface SignalCardProps {
  signal: LteSignal | null;
  history: RouterStatus[];
}

function getSignalColor(quality: string): 'success' | 'warning' | 'error' | 'default' {
  switch (quality) {
    case 'excellent':
    case 'good':
      return 'success';
    case 'fair':
      return 'warning';
    case 'poor':
      return 'error';
    default:
      return 'default';
  }
}

function getProgressColor(quality: string): 'success' | 'warning' | 'error' | 'inherit' {
  switch (quality) {
    case 'excellent':
    case 'good':
      return 'success';
    case 'fair':
      return 'warning';
    case 'poor':
      return 'error';
    default:
      return 'inherit';
  }
}

export default function SignalCard({ signal, history }: SignalCardProps) {
  const signalHistory = history.map(h => h.lte.signalStrength);

  if (!signal) {
    return (
      <Card className="h-full rounded-2xl shadow-xl border border-purple-100/60 bg-white/80 backdrop-blur-sm">
        <CardContent className="h-full flex flex-col gap-2">
          <Typography variant="subtitle2" className="flex items-center gap-2">
            <SignalCellularAltIcon fontSize="small" />
            LTE Signal
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No signal data
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full rounded-2xl shadow-xl border border-purple-100/60 bg-white/80 backdrop-blur-sm">
      <CardContent className="h-full flex flex-col gap-2">
        <Box className="flex items-center justify-between">
          <Typography variant="subtitle2" className="flex items-center gap-2">
            <SignalCellularAltIcon fontSize="small" />
            LTE Signal
          </Typography>
          <Chip
            label={signal.networkTypeName}
            size="small"
            color={getSignalColor(signal.signalQuality)}
          />
        </Box>

        <Box className="flex items-center gap-2">
          <Typography variant="h5">
            {signal.signalStrength}%
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {signal.signalQuality}
          </Typography>
        </Box>

        <LinearProgress
          variant="determinate"
          value={signal.signalStrength}
          color={getProgressColor(signal.signalQuality)}
          className="h-2 rounded"
        />

        <Box className="grid grid-cols-3 gap-2 text-sm mt-1">
          <Box>
            <Typography variant="caption" color="text.secondary">RSRP</Typography>
            <Typography variant="body2">
              {signal.rsrp != null ? `${signal.rsrp} dBm` : '—'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">RSRQ</Typography>
            <Typography variant="body2">
              {signal.rsrq != null ? `${signal.rsrq} dB` : '—'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">SNR</Typography>
            <Typography variant="body2">
              {signal.snr != null ? `${signal.snr} dB` : '—'}
            </Typography>
          </Box>
        </Box>

        {signalHistory.length > 1 && (
          <Box className="mt-auto">
            <Typography variant="caption" color="text.secondary">Signal History</Typography>
            <Sparkline values={signalHistory} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
