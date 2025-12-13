/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type MetricsSnapshot = {
  ts: number;
  cpu: {
    usagePercent: number | null;
    temperatureC: number | null;
  };
  memory: {
    memTotalKB: number;
    memFreeKB: number;
    memAvailableKB: number | null;
    buffersKB: number;
    cachedKB: number;
    sReclaimableKB: number;
    usedKB: number;
    usedPercent: number;
  };
  network: {
    interfaces: Array<{
      interface: string;
      rxBytes: number;
      txBytes: number;
    }>;
    totalRxBytes: number;
    totalTxBytes: number;
    totalRxBytesPerSec: number | null;
    totalTxBytesPerSec: number | null;
  } | null;
};

type Container = {
  id: string;
  name: string;
  cpuPercent: number;
  memPercent: number;
  memMB: number;
};

type SSEContextType = {
  latestMetrics: MetricsSnapshot | null;
  containers: Container[];
  connected: boolean;
  token: string | null;
};

const SSEContext = createContext<SSEContextType>({
  latestMetrics: null,
  containers: [],
  connected: false,
  token: null
});

export function useSSE() {
  return useContext(SSEContext);
}

type SSEProviderProps = {
  token: string | null;
  children: ReactNode;
};

export function SSEProvider({ token, children }: SSEProviderProps) {
  const [latestMetrics, setLatestMetrics] = useState<MetricsSnapshot | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      setConnected(false);
      return;
    }

    // Create single EventSource for all real-time data
    const eventSource = new EventSource(`/api/stream?token=${token}`);

    eventSource.addEventListener('open', () => {
      setConnected(true);
    });

    eventSource.addEventListener('metrics', (event) => {
      try {
        const data = JSON.parse(event.data) as MetricsSnapshot;
        setLatestMetrics(data);
      } catch {
        // Ignore parse errors
      }
    });

    eventSource.addEventListener('containers', (event) => {
      try {
        const data = JSON.parse(event.data) as Container[];
        setContainers(data);
      } catch {
        // Ignore parse errors
      }
    });

    eventSource.addEventListener('error', () => {
      setConnected(false);
      // EventSource will automatically attempt to reconnect
    });

    return () => {
      eventSource.close();
      setConnected(false);
    };
  }, [token]);

  return (
    <SSEContext.Provider value={{ latestMetrics, containers, connected, token }}>
      {children}
    </SSEContext.Provider>
  );
}
