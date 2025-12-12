# Network Metrics Implementation

**Status:** Planning
**Priority:** Medium (after communication unification decision)
**Estimated Complexity:** Low-Medium

## Requirements

- Track internet/network usage for Raspberry Pi
- **Display metrics from ALL network interfaces** (no manual configuration)
- Show download/upload rates in real-time
- Historical trends (sparklines)
- Integrate with existing dashboard

---

## Technical Approach

### Data Source: `/proc/net/dev`

Linux provides network interface statistics in `/proc/net/dev`:

```
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 12345678   123456    0    0    0     0          0         0  12345678   123456    0    0    0     0       0          0
  eth0: 987654321  8765432    0    0    0     0          0         0  456789012  3456789    0    0    0     0       0          0
 wlan0: 234567890  2345678    0    0    0     0          0         0  123456789  1234567    0    0    0     0       0          0
```

**Available Metrics:**
- `rxBytes`: Total bytes received
- `txBytes`: Total bytes transmitted
- `rxPackets`: Total packets received
- `txPackets`: Total packets transmitted
- `rxErrors`, `txErrors`: Error counts
- `rxDropped`, `txDropped`: Dropped packets

---

## Implementation Design

### 1. Backend: Data Collection

**New Module: `backend/src/metrics/procNetDev.ts`**

```typescript
export type NetworkInterfaceStats = {
  interface: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
};

export type NetworkStats = {
  interfaces: NetworkInterfaceStats[];
  totalRxBytes: number;    // Sum of all non-loopback interfaces
  totalTxBytes: number;
  totalRxBytesPerSec: number;  // Calculated rate
  totalTxBytesPerSec: number;
};

/**
 * Read network interface statistics from /proc/net/dev
 * Filters out loopback (lo) interface
 * Returns all active network interfaces
 */
export async function readNetworkStats(): Promise<NetworkStats | null> {
  // Implementation
}
```

**Key Features:**
- Parse `/proc/net/dev`
- Filter out loopback interface (`lo`)
- Return **all active interfaces** automatically
- Aggregate totals across all interfaces
- Handle parsing errors gracefully (return null)

---

### 2. Backend: Rate Calculation

Similar to CPU usage percentage, network rates require delta calculation:

```typescript
// In collector.ts
let previousNetStats: NetworkStats | null = null;
let previousNetTimestamp: number | null = null;

async function pollOnce(): Promise<MetricsSnapshot> {
  const now = Date.now();
  const netStats = await readNetworkStats();

  // Calculate rates
  let netWithRates: NetworkStats | null = null;
  if (netStats && previousNetStats && previousNetTimestamp) {
    const deltaMs = now - previousNetTimestamp;
    const deltaSec = deltaMs / 1000;

    netWithRates = {
      ...netStats,
      totalRxBytesPerSec: (netStats.totalRxBytes - previousNetStats.totalRxBytes) / deltaSec,
      totalTxBytesPerSec: (netStats.totalTxBytes - previousNetStats.totalTxBytes) / deltaSec,
    };
  }

  previousNetStats = netStats;
  previousNetTimestamp = now;

  return {
    ts: now,
    cpu: ...,
    memory: ...,
    network: netWithRates,  // null on first poll
  };
}
```

**Rate Calculation Logic:**
- Store previous sample's byte counts and timestamp
- On next poll, compute delta bytes and delta time
- Rate = `(current_bytes - previous_bytes) / time_delta_seconds`
- Returns bytes/second (can convert to KB/s, MB/s in frontend)

---

### 3. Backend: Type Updates

**Update `backend/src/metrics/types.ts`:**

```typescript
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
    totalRxBytesPerSec: number | null;  // null on first sample
    totalTxBytesPerSec: number | null;
  } | null;
};
```

---

### 4. Frontend: UI Component

**Update `frontend/src/App.tsx`:**

Add a third card in the metrics grid:

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
  {/* CPU Card */}
  <Card>...</Card>

  {/* RAM Card */}
  <Card>...</Card>

  {/* Network Card - NEW */}
  <Card className="h-full rounded-2xl shadow-xl border border-purple-100/60 bg-white/80 backdrop-blur-sm">
    <CardContent className="h-full flex flex-col gap-2">
      <Typography variant="subtitle2">Network</Typography>
      <Typography variant="h5">
        ↓ {formatBytesPerSec(snapshot?.network?.totalRxBytesPerSec)}
      </Typography>
      <Typography variant="h5">
        ↑ {formatBytesPerSec(snapshot?.network?.totalTxBytesPerSec)}
      </Typography>
      <div className="mt-auto space-y-1">
        <div className="text-xs text-gray-500">Download</div>
        <Sparkline values={downloadSeries} color="blue" />
        <div className="text-xs text-gray-500">Upload</div>
        <Sparkline values={uploadSeries} color="green" />
      </div>
    </CardContent>
  </Card>
</div>
```

**Helper Function:**
```typescript
function formatBytesPerSec(bytesPerSec: number | null | undefined): string {
  if (bytesPerSec == null) return '—';

  const abs = Math.abs(bytesPerSec);
  if (abs < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (abs < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / 1024 / 1024).toFixed(2)} MB/s`;
}
```

**Sparkline Data:**
```typescript
const downloadSeries = useMemo(() =>
  samples.map(s => s.network?.totalRxBytesPerSec ?? 0)
, [samples]);

const uploadSeries = useMemo(() =>
  samples.map(s => s.network?.totalTxBytesPerSec ?? 0)
, [samples]);
```

---

### 5. Configuration (Optional)

While the requirement is "no additional configuration", you could add optional env vars for advanced users:

```bash
# Optional: Explicitly exclude/include interfaces
NETWORK_INTERFACES_EXCLUDE=docker0,veth.*  # Regex patterns to exclude
NETWORK_INTERFACES_INCLUDE=eth.*,wlan.*    # Only include matching (overrides exclude)
```

**Default behavior (recommended):**
- Include all interfaces EXCEPT loopback (`lo`)
- Aggregate totals across all included interfaces

---

## Detailed Implementation Steps

### Step 1: Create `backend/src/metrics/procNetDev.ts`

```typescript
import { readFile } from 'fs/promises';

export type NetworkInterfaceStats = {
  interface: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
};

export type NetworkStats = {
  interfaces: NetworkInterfaceStats[];
  totalRxBytes: number;
  totalTxBytes: number;
};

const PROC_NET_DEV = '/proc/net/dev';

export async function readNetworkStats(): Promise<NetworkStats | null> {
  try {
    const content = await readFile(PROC_NET_DEV, 'utf-8');
    const lines = content.split('\n');

    const interfaces: NetworkInterfaceStats[] = [];
    let totalRx = 0;
    let totalTx = 0;

    // Skip header lines (first 2 lines)
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Format: "eth0: 12345 ..."
      const [ifacePart, ...statsParts] = line.split(/\s+/);
      const iface = ifacePart.replace(':', '');

      // Skip loopback
      if (iface === 'lo') continue;

      if (statsParts.length < 16) continue; // Ensure we have enough columns

      const rxBytes = parseInt(statsParts[0], 10);
      const rxPackets = parseInt(statsParts[1], 10);
      const rxErrors = parseInt(statsParts[2], 10);
      const txBytes = parseInt(statsParts[8], 10);
      const txPackets = parseInt(statsParts[9], 10);
      const txErrors = parseInt(statsParts[10], 10);

      interfaces.push({
        interface: iface,
        rxBytes,
        txBytes,
        rxPackets,
        txPackets,
        rxErrors,
        txErrors,
      });

      totalRx += rxBytes;
      totalTx += txBytes;
    }

    return {
      interfaces,
      totalRxBytes: totalRx,
      totalTxBytes: totalTx,
    };
  } catch (error) {
    console.error('Failed to read network stats:', error);
    return null;
  }
}
```

---

### Step 2: Update `backend/src/metrics/collector.ts`

```typescript
import { readNetworkStats, NetworkStats } from './procNetDev';

export type MetricsSnapshot = {
  ts: number;
  cpu: {...};
  memory: {...};
  network: {
    interfaces: Array<{interface: string; rxBytes: number; txBytes: number}>;
    totalRxBytes: number;
    totalTxBytes: number;
    totalRxBytesPerSec: number | null;
    totalTxBytesPerSec: number | null;
  } | null;
};

export class LocalMetricsCollector {
  private previousCpuStat: ProcStat | null = null;
  private previousNetStats: NetworkStats | null = null;
  private previousNetTimestamp: number | null = null;

  async pollOnce(): Promise<MetricsSnapshot> {
    const now = Date.now();

    const [cpuStat, memInfo, tempC, netStats] = await Promise.all([
      readProcStat(),
      readMeminfo(),
      readCpuTemp(),
      readNetworkStats(),
    ]);

    // ... existing CPU calculation ...

    // Calculate network rates
    let networkSnapshot = null;
    if (netStats) {
      let rxRate = null;
      let txRate = null;

      if (this.previousNetStats && this.previousNetTimestamp) {
        const deltaSec = (now - this.previousNetTimestamp) / 1000;
        rxRate = (netStats.totalRxBytes - this.previousNetStats.totalRxBytes) / deltaSec;
        txRate = (netStats.totalTxBytes - this.previousNetStats.totalTxBytes) / deltaSec;
      }

      networkSnapshot = {
        interfaces: netStats.interfaces.map(i => ({
          interface: i.interface,
          rxBytes: i.rxBytes,
          txBytes: i.txBytes,
        })),
        totalRxBytes: netStats.totalRxBytes,
        totalTxBytes: netStats.totalTxBytes,
        totalRxBytesPerSec: rxRate,
        totalTxBytesPerSec: txRate,
      };

      this.previousNetStats = netStats;
      this.previousNetTimestamp = now;
    }

    return {
      ts: now,
      cpu: cpuSnapshot,
      memory: memSnapshot,
      network: networkSnapshot,
    };
  }
}
```

---

### Step 3: Update Frontend

**`frontend/src/App.tsx`:**

1. Add network sparkline series:
```typescript
const downloadSeries = useMemo(() =>
  samples.map(s => (s.network?.totalRxBytesPerSec ?? 0) / 1024 / 1024)  // Convert to MB/s for scaling
, [samples]);

const uploadSeries = useMemo(() =>
  samples.map(s => (s.network?.totalTxBytesPerSec ?? 0) / 1024 / 1024)
, [samples]);
```

2. Add network card to grid (change `md:grid-cols-2` to `md:grid-cols-3`)

3. Add formatting helper

---

## Edge Cases & Error Handling

### 1. Interface Not Available
- **Scenario**: WiFi disconnected, ethernet cable unplugged
- **Handling**: Interface disappears from `/proc/net/dev`
- **Solution**: Display `—` for disconnected interfaces, show only active ones

### 2. First Sample (No Previous Data)
- **Scenario**: First metric collection after startup
- **Handling**: No previous sample to calculate delta
- **Solution**: Return `null` for rate fields, display `—` in UI

### 3. Counter Overflow
- **Scenario**: Byte counters are 64-bit but could theoretically wrap
- **Handling**: Detect negative delta
- **Solution**:
  ```typescript
  if (deltaBytes < 0) {
    // Counter wrapped or interface reset, skip this sample
    rxRate = null;
  }
  ```

### 4. Interface Reset
- **Scenario**: Interface goes down and up, counters reset to 0
- **Handling**: Delta would be negative
- **Solution**: Detect and skip rate calculation for that sample

### 5. Virtual Interfaces
- **Scenario**: Docker creates `docker0`, `veth*` interfaces
- **Handling**: These are usually virtual/internal traffic
- **Solution**:
  - **Option A**: Include all (user sees total system traffic)
  - **Option B**: Filter out common virtual prefixes: `docker`, `veth`, `br-`
  - **Recommended**: Include all by default (user wants "internet usage" but seeing total is fine)

---

## Testing Checklist

- [ ] Metrics collected successfully on Raspberry Pi
- [ ] Works with `eth0` (ethernet)
- [ ] Works with `wlan0` (WiFi)
- [ ] Works with both interfaces active simultaneously
- [ ] Gracefully handles interface disconnect
- [ ] Rates calculated correctly (verify against `iftop` or `nethogs`)
- [ ] UI displays rates in appropriate units (B/s, KB/s, MB/s)
- [ ] Sparklines render correctly
- [ ] No memory leaks in collector
- [ ] No crashes on malformed `/proc/net/dev`

---

## Display Example

```
┌─────────────────────────────────────┐
│ Network (eth0, wlan0)               │
│                                     │
│ ↓  2.5 MB/s                         │
│ ↑  0.8 MB/s                         │
│                                     │
│ Download                            │
│ [████░░░░░░░░░░░░]                  │
│ Upload                              │
│ [██░░░░░░░░░░░░░░]                  │
│                                     │
│ Active: eth0, wlan0                 │
└─────────────────────────────────────┘
```

---

## Optional Enhancements (Future)

1. **Per-Interface Breakdown**
   - Expandable section showing each interface separately
   - Useful for debugging WiFi vs Ethernet performance

2. **Total Transferred Today**
   - Track cumulative bytes since midnight
   - Useful for data cap monitoring

3. **Alerting**
   - Warn if download > X MB/s (ISP throttling?)
   - Warn if unexpected traffic detected

4. **Packet Loss Tracking**
   - Show `rxErrors` and `txErrors`
   - Indicates network issues

---

## File Checklist

**Backend:**
- [ ] `backend/src/metrics/procNetDev.ts` (new)
- [ ] `backend/src/metrics/collector.ts` (update)
- [ ] `backend/src/metrics/types.ts` (update)

**Frontend:**
- [ ] `frontend/src/App.tsx` (update)

**Optional:**
- [ ] `backend/src/config/index.ts` (if adding config vars)
- [ ] Unit tests for `procNetDev.ts`

---

## Estimated Effort

- **Backend implementation**: 2-3 hours
- **Frontend integration**: 1-2 hours
- **Testing & refinement**: 1-2 hours
- **Total**: ~4-7 hours

---

## Summary

Network metrics implementation is straightforward and follows the existing pattern:

1. ✅ Read from `/proc/net/dev` (like CPU from `/proc/stat`)
2. ✅ Calculate rates using deltas (like CPU usage %)
3. ✅ Display in dashboard card with sparklines (like CPU/RAM)
4. ✅ Automatically includes all interfaces (no config needed)
5. ✅ Aggregates total across all non-loopback interfaces

**No blockers. Ready to implement after communication pattern decision.**
