import { Card, CardContent, Typography, Box } from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Sparkline from '../Sparkline';
import { formatBytes, formatBytesPerSec } from '../../utils/formatBytes';
import type { WanTraffic, RouterStatus } from '../../types/router';

interface TrafficCardProps {
  traffic: WanTraffic | null;
  history: RouterStatus[];
}

export default function TrafficCard({ traffic, history }: TrafficCardProps) {
  const downloadHistory = history.map(h => h.wan.downloadBytesPerSec / 1024 / 1024);
  const uploadHistory = history.map(h => h.wan.uploadBytesPerSec / 1024 / 1024);

  if (!traffic) {
    return (
      <Card className="h-full rounded-2xl shadow-xl border border-purple-100/60 bg-white/80 backdrop-blur-sm">
        <CardContent className="h-full flex flex-col gap-2">
          <Typography variant="subtitle2">WAN Traffic</Typography>
          <Typography variant="body2" color="text.secondary">
            No traffic data
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full rounded-2xl shadow-xl border border-purple-100/60 bg-white/80 backdrop-blur-sm">
      <CardContent className="h-full flex flex-col gap-2">
        <Typography variant="subtitle2">WAN Traffic</Typography>

        <Box className="flex items-center gap-2">
          <CloudDownloadIcon className="text-blue-500" fontSize="small" />
          <Typography variant="h6" className="text-blue-600">
            {formatBytesPerSec(traffic.downloadBytesPerSec)}
          </Typography>
        </Box>

        <Box className="flex items-center gap-2">
          <CloudUploadIcon className="text-green-500" fontSize="small" />
          <Typography variant="h6" className="text-green-600">
            {formatBytesPerSec(traffic.uploadBytesPerSec)}
          </Typography>
        </Box>

        <Box className="text-sm mt-1">
          <Typography variant="caption" color="text.secondary">Total Traffic</Typography>
          <Typography variant="body2">
            {formatBytes(traffic.totalBytes)}
          </Typography>
        </Box>

        {downloadHistory.length > 1 && (
          <Box className="mt-auto space-y-1">
            <Typography variant="caption" color="text.secondary">Download</Typography>
            <Sparkline values={downloadHistory} />
            <Typography variant="caption" color="text.secondary">Upload</Typography>
            <Sparkline values={uploadHistory} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
