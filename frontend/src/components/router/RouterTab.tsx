import { Box, Typography, Alert } from '@mui/material';
import { useSSE } from '../../context/SSEContext';
import SignalCard from './SignalCard';
import TrafficCard from './TrafficCard';
import DevicesTable from './DevicesTable';
import StatusBar from './StatusBar';

export default function RouterTab() {
  const { latestRouter, routerHistory, routerError, routerEnabled } = useSSE();

  if (!routerEnabled) {
    return (
      <Box className="space-y-4">
        <Alert severity="info">
          Router monitoring is not enabled. Set <code>ENABLE_ROUTER_STATS=true</code> and configure router credentials to enable this feature.
        </Alert>
      </Box>
    );
  }

  return (
    <Box className="space-y-4">
      <Typography variant="h5" className="font-semibold text-gray-700">
        Router Status
      </Typography>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SignalCard
          signal={latestRouter?.lte ?? null}
          history={routerHistory}
        />
        <TrafficCard
          traffic={latestRouter?.wan ?? null}
          history={routerHistory}
        />
      </div>

      <DevicesTable
        devices={latestRouter?.devices ?? []}
        counts={latestRouter?.deviceCounts ?? null}
      />

      <StatusBar
        connection={latestRouter?.connection ?? null}
        sim={latestRouter?.sim ?? null}
        system={latestRouter?.system ?? null}
        lastUpdated={latestRouter?.timestamp ?? null}
        error={routerError}
      />
    </Box>
  );
}
