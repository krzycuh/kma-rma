# Plan Implementacji: Router Indicator

**Wersja:** 2.0 (zaktualizowany po decyzjach)
**Architektura:** Python subprocess

## 1. Podsumowanie architektury

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  ┌──────────────┐  ┌──────────────────────────────────────────┐ │
│  │   Tab Nav    │  │  RouterTab.tsx                           │ │
│  │ System|Router│  │  ├─ SignalCard.tsx (+ sparkline)         │ │
│  └──────────────┘  │  ├─ TrafficCard.tsx (+ sparkline)        │ │
│                    │  ├─ DevicesTable.tsx                     │ │
│                    │  └─ StatusBar.tsx                        │ │
│                    └──────────────────────────────────────────┘ │
│                              ↑ SSE events: "router"             │
└──────────────────────────────┼──────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────┐
│                         BACKEND (Node.js)                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  SSE StreamManager                                       │   │
│  │  └─ broadcasts: "metrics", "containers", "router"        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↑                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  RouterService                                           │   │
│  │  ├─ RouterCollector (spawns Python subprocess)           │   │
│  │  ├─ RouterStatus cache + history buffer                  │   │
│  │  └─ RouterBroadcaster (SSE push)                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↑ JSON stdout                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  router_client.py (Python script)                        │   │
│  │  ├─ import tplinkrouterc6u                               │   │
│  │  ├─ Connect, fetch all data                              │   │
│  │  └─ Print JSON to stdout                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │ HTTP
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                      TP-LINK TL-MR100                           │
│                    (HTTP API, port 80)                          │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Fazy implementacji

### Faza 1: Python Script

**Cel:** Skrypt Python komunikujący się z routerem

**Pliki do utworzenia:**
```
backend/
├── scripts/
│   └── router_client.py      # Główny skrypt
├── requirements.txt          # Zależności Python (lub osobny dla scripts/)
```

**Zadania:**
1. [ ] Utworzyć `router_client.py` z argumentami CLI
2. [ ] Zaimplementować pobieranie wszystkich danych z routera
3. [ ] Zwracać JSON na stdout
4. [ ] Obsłużyć błędy (timeout, auth, connection)
5. [ ] Przetestować ręcznie z routerem

**Interfejs skryptu:**
```bash
# Wywołanie
python3 router_client.py \
  --host 192.168.0.1 \
  --username admin \
  --password "haslo"

# Output (stdout) - sukces
{
  "success": true,
  "data": { /* RouterStatus */ },
  "timestamp": 1706620800000
}

# Output (stdout) - błąd
{
  "success": false,
  "error": "Connection timeout",
  "errorCode": "TIMEOUT"
}
```

**Kody błędów:**
- `AUTH_FAILED` - nieprawidłowe hasło
- `TIMEOUT` - timeout połączenia
- `CONNECTION_ERROR` - nie można połączyć
- `PARSE_ERROR` - nieoczekiwana odpowiedź routera

### Faza 2: Backend - Typy i konfiguracja

**Cel:** Typy TypeScript i konfiguracja środowiskowa

**Pliki do utworzenia/modyfikacji:**
```
backend/src/
├── router/
│   └── types.ts              # Typy danych routera
├── config/
│   └── index.ts              # Dodać zmienne routera
```

**Zadania:**
1. [ ] Zdefiniować typy TypeScript dla RouterStatus
2. [ ] Dodać zmienne środowiskowe do config
3. [ ] Dodać walidację konfiguracji

**Zmienne środowiskowe:**
```typescript
// backend/src/config/index.ts
export const config = {
  // ... existing config
  enableRouterStats: process.env.ENABLE_ROUTER_STATS === 'true',
  routerIp: process.env.ROUTER_IP || '192.168.0.1',
  routerPassword: process.env.ROUTER_PASSWORD || 'admin',
  routerUsername: process.env.ROUTER_USERNAME || 'admin',
  routerHttps: process.env.ROUTER_HTTPS === 'true',
  routerPollIntervalMs: parseInt(process.env.ROUTER_POLL_INTERVAL_MS || '5000'),
  routerHistorySize: parseInt(process.env.ROUTER_HISTORY_SIZE || '60'),
};
```

### Faza 3: Backend - Serwis routera

**Cel:** Collector, Service i Broadcaster

**Pliki do utworzenia:**
```
backend/src/
├── router/
│   ├── types.ts              # (z Fazy 2)
│   ├── collector.ts          # RouterCollector - wywołuje Python
│   ├── service.ts            # RouterService - cache + history
│   └── broadcaster.ts        # RouterBroadcaster - SSE
```

**Zadania:**
1. [ ] Zaimplementować `RouterCollector` z child_process.spawn
2. [ ] Zaimplementować `RouterService` z buforem historii
3. [ ] Zaimplementować `RouterBroadcaster` (wzorowany na ContainerBroadcaster)
4. [ ] Zintegrować z `server.ts` (warunkowe uruchomienie)
5. [ ] Dodać endpoint `/api/router/history`
6. [ ] Obsłużyć graceful degradation (stale data)

**RouterCollector - kluczowy kod:**
```typescript
// backend/src/router/collector.ts
import { spawn } from 'child_process';
import { RouterStatus, RouterError } from './types';

export class RouterCollector {
  private config: RouterConfig;
  private pythonScript: string;

  constructor(config: RouterConfig) {
    this.config = config;
    this.pythonScript = path.join(__dirname, '../../scripts/router_client.py');
  }

  async collect(): Promise<RouterStatus | RouterError> {
    return new Promise((resolve, reject) => {
      const args = [
        this.pythonScript,
        '--host', this.config.routerIp,
        '--username', this.config.routerUsername,
        '--password', this.config.routerPassword,
      ];

      if (this.config.routerHttps) {
        args.push('--https');
      }

      const proc = spawn('python3', args, {
        timeout: 15000,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data; });
      proc.stderr.on('data', (data) => { stderr += data; });

      proc.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (e) {
            reject(new Error('Invalid JSON from Python script'));
          }
        } else {
          reject(new Error(`Python script failed: ${stderr}`));
        }
      });
    });
  }
}
```

### Faza 4: Frontend - Typy i Context

**Cel:** Rozszerzenie SSE context o dane routera

**Pliki do modyfikacji:**
```
frontend/src/
├── types/
│   └── router.ts             # Nowy - typy routera
├── context/
│   └── SSEContext.tsx        # Dodać obsługę "router" events
```

**Zadania:**
1. [ ] Skopiować/zsynchronizować typy z backend
2. [ ] Rozszerzyć SSEContext o `latestRouter` i `routerHistory`
3. [ ] Dodać event listener dla "router"
4. [ ] Dodać hook `useRouterData()` (opcjonalnie)

**SSEContext rozszerzenie:**
```typescript
// frontend/src/context/SSEContext.tsx

interface SSEContextValue {
  // existing
  latestMetrics: MetricsSnapshot | null;
  metricsHistory: MetricsSnapshot[];
  latestContainers: ContainerStats[] | null;

  // new
  latestRouter: RouterStatus | null;
  routerHistory: RouterStatus[];
  routerError: string | null;
  routerLastUpdated: number | null;
}

// W event listener
eventSource.addEventListener('router', (event) => {
  const data = JSON.parse(event.data);
  if (data.success) {
    setLatestRouter(data.data);
    setRouterHistory(prev => [...prev.slice(-historySize + 1), data.data]);
    setRouterLastUpdated(Date.now());
    setRouterError(null);
  } else {
    setRouterError(data.error);
  }
});
```

### Faza 5: Frontend - Komponenty UI

**Cel:** Implementacja widoku zakładki Router

**Pliki do utworzenia/modyfikacji:**
```
frontend/src/
├── App.tsx                   # Dodać system zakładek
├── components/
│   ├── tabs/
│   │   └── TabNavigation.tsx # Komponent nawigacji zakładek
│   ├── router/
│   │   ├── RouterTab.tsx     # Główny kontener zakładki
│   │   ├── SignalCard.tsx    # Karta jakości sygnału
│   │   ├── TrafficCard.tsx   # Karta ruchu WAN
│   │   ├── DevicesTable.tsx  # Tabela urządzeń
│   │   └── StatusBar.tsx     # Pasek statusu
│   └── shared/
│       └── SignalStrengthBar.tsx  # Reużywalny wskaźnik
```

**Zadania:**
1. [ ] Zaimplementować `TabNavigation` z MUI Tabs
2. [ ] Zmodyfikować `App.tsx` - dodać zakładki
3. [ ] Zaimplementować `RouterTab` z układem kart
4. [ ] Zaimplementować `SignalCard` z:
   - Progress bar jakości sygnału (kolorowy)
   - Wartości RSRP, RSRQ, SNR
   - Typ sieci (4G/LTE badge)
   - Sparkline historii
5. [ ] Zaimplementować `TrafficCard` z:
   - Download/Upload bieżący (auto units)
   - Dual sparkline (RX/TX)
   - Total session transfer
6. [ ] Zaimplementować `DevicesTable` z:
   - Tylko aktywne urządzenia
   - Kolumny: Device, IP, Type, Traffic
   - Sortowanie po kolumnach
7. [ ] Zaimplementować `StatusBar` z:
   - Operator
   - Uptime
   - WAN IP
   - Last updated (stale indicator)
8. [ ] Obsłużyć stany: loading, error, unconfigured, stale

### Faza 6: Docker i dokumentacja

**Cel:** Integracja z Docker i dokumentacja

**Pliki do modyfikacji:**
```
├── Dockerfile                # Dodać Python + pip
├── docker-compose.yml        # Przykładowa konfiguracja
├── README.md                 # Dokumentacja feature
├── ARCHITECTURE.md           # Zaktualizować diagram
```

**Zadania:**
1. [ ] Zmodyfikować Dockerfile - dodać Python 3 i tplinkrouterc6u
2. [ ] Zaktualizować docker-compose.yml z przykładem
3. [ ] Napisać dokumentację konfiguracji w README
4. [ ] Zaktualizować ARCHITECTURE.md

**Dockerfile zmiany:**
```dockerfile
# Dodać do etapu runtime
RUN apk add --no-cache python3 py3-pip
RUN pip3 install tplinkrouterc6u

# Skopiować skrypt Python
COPY backend/scripts/ /app/scripts/
```

### Faza 7: Testy

**Zadania:**
1. [ ] Test jednostkowy RouterCollector (mock subprocess)
2. [ ] Test jednostkowy RouterService
3. [ ] Test integracyjny (opcjonalnie, wymaga routera)
4. [ ] Test manualny E2E

## 3. Szczegóły techniczne

### 3.1 Struktura danych RouterStatus

```typescript
// backend/src/router/types.ts

export interface LteSignal {
  networkType: NetworkType;
  networkTypeName: string;  // "4G LTE", "3G", etc.
  rsrp: number;             // dBm, e.g., -85
  rsrq: number;             // dB, e.g., -12
  snr: number;              // dB, e.g., 15
  signalStrength: number;   // 0-100% (calculated)
  signalQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

export enum NetworkType {
  NoService = 0,
  GSM = 1,
  WCDMA = 2,
  LTE = 3,
  TDSCDMA = 4,
  CDMA1x = 5,
  CDMAEvDo = 6,
  LTEPlus = 7
}

export interface SimStatus {
  status: SimStatusCode;
  statusText: string;
  isOk: boolean;
}

export enum SimStatusCode {
  NoSimOrError = 0,
  NoSim = 1,
  SimError = 2,
  SimReady = 3,
  SimLocked = 4,
  SimUnlocked = 5,
  PinLocked = 6,
  PermLocked = 7,
  Suspended = 8,
  Unopened = 9
}

export interface WanTraffic {
  downloadBytesPerSec: number;
  uploadBytesPerSec: number;
  totalDownloadBytes: number;
  totalUploadBytes: number;
}

export interface ConnectedDevice {
  macAddress: string;
  ipAddress: string;
  hostname: string;
  displayName: string;      // hostname lub "Unknown-XXXX"
  connectionType: 'wired' | 'wifi_2g' | 'wifi_5g' | 'wifi_6g';
  signalStrength?: number;  // tylko dla WiFi, 0-100
  downloadBytesPerSec: number;
  uploadBytesPerSec: number;
  isActive: boolean;
}

export interface RouterStatus {
  timestamp: number;
  lte: LteSignal;
  sim: SimStatus;
  wan: WanTraffic;
  devices: ConnectedDevice[];
  deviceCounts: {
    total: number;
    wired: number;
    wifi: number;
    active: number;
  };
  connection: {
    wanIp: string;
    uptimeSeconds: number;
    ispName: string;
  };
  system: {
    cpuUsage: number;       // 0-1
    memoryUsage: number;    // 0-1
    firmwareVersion: string;
    model: string;
  };
}

export interface RouterResult {
  success: boolean;
  data?: RouterStatus;
  error?: string;
  errorCode?: 'AUTH_FAILED' | 'TIMEOUT' | 'CONNECTION_ERROR' | 'PARSE_ERROR';
  timestamp: number;
}
```

### 3.2 Python Script - szczegóły

```python
#!/usr/bin/env python3
# backend/scripts/router_client.py

import argparse
import json
import sys
from datetime import datetime

try:
    from tplinkrouterc6u import (
        TplinkRouterProvider,
        TPLinkMRClient,
    )
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "tplinkrouterc6u not installed",
        "errorCode": "MISSING_DEPENDENCY",
        "timestamp": int(datetime.now().timestamp() * 1000)
    }))
    sys.exit(1)


def get_signal_quality(rsrp: int) -> str:
    """Calculate signal quality from RSRP."""
    if rsrp > -80:
        return "excellent"
    elif rsrp > -90:
        return "good"
    elif rsrp > -100:
        return "fair"
    return "poor"


def get_signal_strength(rsrp: int) -> int:
    """Calculate signal strength percentage from RSRP."""
    # RSRP ranges from -140 (worst) to -44 (best)
    # Map to 0-100%
    if rsrp >= -44:
        return 100
    if rsrp <= -140:
        return 0
    return int((rsrp + 140) / 96 * 100)


def get_display_name(hostname: str, mac: str) -> str:
    """Get display name for device."""
    if hostname and hostname.strip():
        return hostname
    # Use last 4 chars of MAC
    return f"Unknown-{mac[-5:].replace(':', '')}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', required=True)
    parser.add_argument('--username', default='admin')
    parser.add_argument('--password', required=True)
    parser.add_argument('--https', action='store_true')
    args = parser.parse_args()

    timestamp = int(datetime.now().timestamp() * 1000)

    try:
        # Connect to router
        client = TplinkRouterProvider.get_client(
            host=args.host,
            password=args.password,
            username=args.username,
            https=args.https
        )
        client.authorize()

        # Fetch all data
        status = client.get_status()
        lte_status = client.get_lte_status()
        ipv4_status = client.get_ipv4_status()
        firmware = client.get_firmware()

        # Build response
        result = {
            "success": True,
            "timestamp": timestamp,
            "data": {
                "timestamp": timestamp,
                "lte": {
                    "networkType": lte_status.network_type,
                    "networkTypeName": lte_status.network_type_name,
                    "rsrp": lte_status.rsrp,
                    "rsrq": lte_status.rsrq,
                    "snr": lte_status.snr,
                    "signalStrength": get_signal_strength(lte_status.rsrp),
                    "signalQuality": get_signal_quality(lte_status.rsrp),
                },
                "sim": {
                    "status": lte_status.sim_status,
                    "statusText": lte_status.sim_status_text,
                    "isOk": lte_status.sim_status == 5,  # SIM unlocked
                },
                "wan": {
                    "downloadBytesPerSec": lte_status.download_rate,
                    "uploadBytesPerSec": lte_status.upload_rate,
                    "totalDownloadBytes": lte_status.total_download,
                    "totalUploadBytes": lte_status.total_upload,
                },
                "devices": [
                    {
                        "macAddress": d.mac,
                        "ipAddress": d.ip,
                        "hostname": d.name,
                        "displayName": get_display_name(d.name, d.mac),
                        "connectionType": d.type,
                        "signalStrength": getattr(d, 'signal', None),
                        "downloadBytesPerSec": getattr(d, 'down_speed', 0),
                        "uploadBytesPerSec": getattr(d, 'up_speed', 0),
                        "isActive": d.active,
                    }
                    for d in status.devices
                    if d.active  # Only active devices
                ],
                "deviceCounts": {
                    "total": status.devices_total,
                    "wired": status.wired_total,
                    "wifi": status.wifi_clients_total,
                    "active": len([d for d in status.devices if d.active]),
                },
                "connection": {
                    "wanIp": ipv4_status.wan_ip,
                    "uptimeSeconds": ipv4_status.uptime,
                    "ispName": lte_status.isp_name,
                },
                "system": {
                    "cpuUsage": status.cpu_usage,
                    "memoryUsage": status.mem_usage,
                    "firmwareVersion": firmware.firmware_version,
                    "model": firmware.model,
                },
            }
        }

        client.logout()
        print(json.dumps(result))

    except Exception as e:
        error_code = "CONNECTION_ERROR"
        if "auth" in str(e).lower() or "password" in str(e).lower():
            error_code = "AUTH_FAILED"
        elif "timeout" in str(e).lower():
            error_code = "TIMEOUT"

        print(json.dumps({
            "success": False,
            "error": str(e),
            "errorCode": error_code,
            "timestamp": timestamp
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
```

### 3.3 Formatowanie jednostek (auto)

```typescript
// frontend/src/utils/formatBytes.ts

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatBytesPerSec(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}
```

## 4. Harmonogram

| Faza | Zadania | Szacunek |
|------|---------|----------|
| 1 | Python Script | 0.5 dnia |
| 2 | Backend - Typy i config | 0.5 dnia |
| 3 | Backend - Serwis | 1-1.5 dnia |
| 4 | Frontend - Typy i Context | 0.5 dnia |
| 5 | Frontend - Komponenty | 2-2.5 dni |
| 6 | Docker i dokumentacja | 0.5 dnia |
| 7 | Testy | 0.5 dnia |
| **Suma** | | **~6-7 dni** |

## 5. Ryzyka i mitygacje

| Ryzyko | Prawdopodobieństwo | Impact | Mitygacja |
|--------|-------------------|--------|-----------|
| Subprocess overhead | Niskie | Niski | Polling co 5s, nie krytyczne |
| Python nie w kontenerze | Średnie | Średni | Jawna dokumentacja, test w Dockerfile |
| Biblioteka zmieni API | Niskie | Średni | Pinowanie wersji, testy |
| Router sesja zajęta | Średnie | Niski | Krótkie sesje, retry |

## 6. Kryteria akceptacji MVP

- [ ] Wyświetlanie siły sygnału LTE z wykresem historii
- [ ] Wyświetlanie typu sieci (4G/LTE badge)
- [ ] Wyświetlanie ruchu WAN z wykresem
- [ ] Lista aktywnych urządzeń
- [ ] Status: operator, uptime, WAN IP
- [ ] Graceful handling: unconfigured, error, stale data
- [ ] System zakładek działa
- [ ] Docker build działa z Python
