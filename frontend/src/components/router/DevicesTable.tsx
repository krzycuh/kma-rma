import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Box
} from '@mui/material';
import WifiIcon from '@mui/icons-material/Wifi';
import CableIcon from '@mui/icons-material/Cable';
import DevicesIcon from '@mui/icons-material/Devices';
import type { ConnectedDevice, DeviceCounts } from '../../types/router';

function formatPackets(packets: number | null): string {
  if (packets === null) return '-';
  if (packets >= 1_000_000_000) {
    return `${(packets / 1_000_000_000).toFixed(1)}G`;
  }
  if (packets >= 1_000_000) {
    return `${(packets / 1_000_000).toFixed(1)}M`;
  }
  if (packets >= 1_000) {
    return `${(packets / 1_000).toFixed(1)}K`;
  }
  return packets.toString();
}

interface DevicesTableProps {
  devices: ConnectedDevice[];
  counts: DeviceCounts | null;
}

function getConnectionIcon(type: string) {
  if (type === 'wired') {
    return <CableIcon fontSize="small" className="text-gray-500" />;
  }
  return <WifiIcon fontSize="small" className="text-blue-500" />;
}

function getConnectionLabel(type: string): string {
  switch (type) {
    case 'wired':
      return 'Wired';
    case 'wifi_2g':
      return '2.4G';
    case 'wifi_5g':
      return '5G';
    case 'wifi_6g':
      return '6G';
    default:
      return 'WiFi';
  }
}

export default function DevicesTable({ devices, counts }: DevicesTableProps) {
  return (
    <Card className="h-full rounded-2xl shadow-xl border border-purple-100/60 bg-white/80 backdrop-blur-sm">
      <CardContent className="h-full flex flex-col gap-2">
        <Box className="flex items-center justify-between">
          <Typography variant="subtitle2" className="flex items-center gap-2">
            <DevicesIcon fontSize="small" />
            Connected Devices
          </Typography>
          {counts && (
            <Box className="flex gap-2">
              <Chip
                label={`${counts.active} active`}
                size="small"
                color="primary"
                variant="outlined"
              />
              {counts.wifi > 0 && (
                <Chip
                  label={`${counts.wifi} WiFi`}
                  size="small"
                  variant="outlined"
                />
              )}
              {counts.wired > 0 && (
                <Chip
                  label={`${counts.wired} Wired`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          )}
        </Box>

        {devices.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No active devices
          </Typography>
        ) : (
          <TableContainer className="mt-2">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Device</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Packets</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.macAddress} hover>
                    <TableCell>
                      <Typography variant="body2" className="font-medium">
                        {device.displayName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {device.macAddress}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {device.ipAddress}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box className="flex items-center gap-1">
                        {getConnectionIcon(device.connectionType)}
                        <Typography variant="body2">
                          {getConnectionLabel(device.connectionType)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" className="text-blue-600">
                        ↓ {formatPackets(device.packetsReceived)}
                      </Typography>
                      <Typography variant="body2" className="text-green-600">
                        ↑ {formatPackets(device.packetsSent)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
