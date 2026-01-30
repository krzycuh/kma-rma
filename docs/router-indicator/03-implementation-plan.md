# Plan Implementacji: Router Indicator

## 1. Podsumowanie architektury

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  ┌──────────────┐  ┌──────────────────────────────────────────┐ │
│  │   Tab Nav    │  │  RouterTab.tsx                           │ │
│  │ System|Router│  │  ├─ SignalCard.tsx                       │ │
│  └──────────────┘  │  ├─ TrafficCard.tsx                      │ │
│                    │  ├─ DevicesTable.tsx                     │ │
│                    │  └─ StatusBar.tsx                        │ │
│                    └──────────────────────────────────────────┘ │
│                              ↑ SSE events: "router"             │
└──────────────────────────────┼──────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────┐
│                         BACKEND                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  SSE StreamManager                                       │   │
│  │  └─ broadcasts: "metrics", "containers", "router"        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↑                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  RouterService (NEW)                                     │   │
│  │  ├─ RouterCollector (polling TP-Link API)                │   │
│  │  ├─ RouterStatus cache (latest data)                     │   │
│  │  └─ RouterBroadcaster (SSE push)                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↑                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  tplink-client.ts (HTTP calls to router)                 │   │
│  │  └─ Wrapper around tplinkrouterc6u (lub własna impl.)   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                      TP-LINK TL-MR100                           │
│                    (HTTP API, port 80/443)                      │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Fazy implementacji

### Faza 1: Backend - Klient TP-Link

**Cel:** Komunikacja z routerem i pobieranie danych

**Pliki do utworzenia:**
```
backend/src/
├── router/
│   ├── types.ts              # Typy danych routera
│   ├── tplink-client.ts      # Klient HTTP do routera
│   ├── collector.ts          # RouterCollector (polling)
│   ├── service.ts            # RouterService (cache + history)
│   └── broadcaster.ts        # RouterBroadcaster (SSE)
```

**Zadania:**
1. [ ] Zdefiniować typy TypeScript dla danych routera
2. [ ] Zaimplementować klienta TP-Link (port biblioteki Python lub własna implementacja)
3. [ ] Dodać konfigurację środowiskową (ROUTER_IP, ROUTER_PASSWORD, etc.)
4. [ ] Napisać testy jednostkowe dla klienta

**Decyzja techniczna: Jak zaimplementować klienta?**

| Opcja | Zalety | Wady |
|-------|--------|------|
| **A: Port biblioteki Python do TS** | Pełna kontrola, brak zależności zewnętrznych | Czasochłonne, reverse engineering API |
| **B: Python subprocess** | Szybkie, wykorzystuje gotową bibliotekę | Zależność od Python, overhead subprocess |
| **C: Python HTTP microservice** | Separacja, łatwy development | Dodatkowy kontener, złożoność |

**Rekomendacja:** Opcja A (port do TypeScript) - dla spójności z resztą backendu.

### Faza 2: Backend - Serwis i broadcasting

**Cel:** Integracja z istniejącym systemem SSE

**Zadania:**
1. [ ] Zaimplementować RouterCollector (podobny do LocalMetricsCollector)
2. [ ] Zaimplementować RouterService z cache i historią
3. [ ] Zaimplementować RouterBroadcaster (wzorowany na ContainerBroadcaster)
4. [ ] Zintegrować z server.ts (warunkowe uruchomienie jeśli skonfigurowany)
5. [ ] Dodać endpoint `/api/router/history`

**Nowe zmienne środowiskowe:**
```bash
# Router configuration (optional feature)
ENABLE_ROUTER_STATS=false          # Feature flag
ROUTER_IP=192.168.0.1              # Router IP address
ROUTER_PASSWORD=admin              # Router admin password
ROUTER_USERNAME=admin              # Router username (default: admin)
ROUTER_HTTPS=false                 # Use HTTPS (requires router config)
ROUTER_POLL_INTERVAL_MS=5000       # Polling interval (min 3000)
ROUTER_HISTORY_SIZE=60             # History buffer size
```

### Faza 3: Frontend - Typy i Context

**Cel:** Rozszerzenie SSE context o dane routera

**Pliki do modyfikacji:**
```
frontend/src/
├── context/
│   └── SSEContext.tsx           # Dodać obsługę "router" events
├── types/
│   └── router.ts                # Nowy plik z typami
```

**Zadania:**
1. [ ] Dodać typy RouterStatus do frontend
2. [ ] Rozszerzyć SSEContext o obsługę eventów "router"
3. [ ] Dodać hook useRouterData() (opcjonalnie)

### Faza 4: Frontend - Komponenty UI

**Cel:** Implementacja widoku zakładki Router

**Pliki do utworzenia:**
```
frontend/src/
├── components/
│   ├── router/
│   │   ├── RouterTab.tsx         # Główny kontener zakładki
│   │   ├── SignalCard.tsx        # Karta jakości sygnału
│   │   ├── TrafficCard.tsx       # Karta ruchu WAN
│   │   ├── DevicesTable.tsx      # Tabela urządzeń
│   │   └── StatusBar.tsx         # Pasek statusu
│   └── shared/
│       └── SignalStrengthBar.tsx # Reużywalny wskaźnik
```

**Zadania:**
1. [ ] Zaimplementować system zakładek w App.tsx (MUI Tabs)
2. [ ] Zaimplementować RouterTab z układem kart
3. [ ] Zaimplementować SignalCard z wskaźnikiem jakości
4. [ ] Zaimplementować TrafficCard ze sparkline
5. [ ] Zaimplementować DevicesTable z sortowaniem
6. [ ] Zaimplementować StatusBar
7. [ ] Obsłużyć stany: loading, error, unconfigured

### Faza 5: Testy i dokumentacja

**Zadania:**
1. [ ] Testy jednostkowe klienta TP-Link
2. [ ] Testy integracyjne RouterService
3. [ ] Testy komponentów React (opcjonalnie)
4. [ ] Aktualizacja README z nową konfiguracją
5. [ ] Aktualizacja ARCHITECTURE.md

## 3. Szczegóły techniczne

### 3.1 Struktura danych RouterStatus

```typescript
// backend/src/router/types.ts

export interface LteSignal {
  networkType: NetworkType;
  rsrp: number;          // dBm, e.g., -85
  rsrq: number;          // dB, e.g., -12
  snr: number;           // dB, e.g., 15
  signalStrength: number; // 0-100%
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
  connectionType: 'wired' | 'wifi_2g' | 'wifi_5g' | 'wifi_6g';
  signalStrength?: number;  // tylko dla WiFi
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
  };
  connection: {
    wanIp: string;
    uptimeSeconds: number;
    ispName: string;
  };
  system: {
    cpuUsage: number;    // 0-1
    memoryUsage: number; // 0-1
    firmwareVersion: string;
    model: string;
  };
}
```

### 3.2 Klient TP-Link - podstawowy interfejs

```typescript
// backend/src/router/tplink-client.ts

export interface TplinkClientConfig {
  host: string;
  password: string;
  username?: string;  // default: 'admin'
  useHttps?: boolean; // default: false
  timeout?: number;   // default: 10000
}

export interface TplinkClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  getLteStatus(): Promise<LteStatus>;
  getStatus(): Promise<SystemStatus>;
  getConnectedDevices(): Promise<ConnectedDevice[]>;
  getIpv4Status(): Promise<Ipv4Status>;
  getFirmware(): Promise<FirmwareInfo>;
}
```

### 3.3 SSE Event format

```typescript
// Nowy typ eventu w SSE stream
interface RouterSSEEvent {
  type: 'router';
  data: RouterStatus;
}
```

### 3.4 Integracja z istniejącym kodem

**server.ts:**
```typescript
// Conditional router initialization
if (config.enableRouterStats && config.routerIp) {
  const routerService = new RouterService(config);
  routerService.start();

  // Register broadcaster
  routerBroadcaster = new RouterBroadcaster(routerService, streamManager);
  routerBroadcaster.start();
}
```

**SSEContext.tsx:**
```typescript
// Rozszerzenie istniejącego context
interface SSEContextValue {
  latestMetrics: MetricsSnapshot | null;
  latestContainers: ContainerStats[] | null;
  latestRouter: RouterStatus | null;  // NEW
  token: string | null;
}

// W event listener
eventSource.addEventListener('router', (event) => {
  const data = JSON.parse(event.data) as RouterStatus;
  setLatestRouter(data);
});
```

## 4. Harmonogram (propozycja)

| Faza | Zadania | Szacunek |
|------|---------|----------|
| 1 | Backend - Klient TP-Link | 2-3 dni |
| 2 | Backend - Serwis i broadcasting | 1-2 dni |
| 3 | Frontend - Typy i Context | 0.5 dnia |
| 4 | Frontend - Komponenty UI | 2-3 dni |
| 5 | Testy i dokumentacja | 1 dzień |
| **Suma** | | **~7-10 dni** |

## 5. Ryzyka i mitygacje

| Ryzyko | Prawdopodobieństwo | Impact | Mitygacja |
|--------|-------------------|--------|-----------|
| API routera nieudokumentowane | Średnie | Wysoki | Reverse engineering z biblioteki Python |
| Różnice w firmware | Średnie | Średni | Auto-detekcja wersji, graceful degradation |
| Sesja pojedyncza (1 user) | Pewne | Niski | Krótkie sesje, keep-alive tylko gdy potrzebne |
| Timeout przy słabym sygnale | Średnie | Niski | Retry logic, ostatnie znane dane |

## 6. Kryteria akceptacji

### MVP (Minimum Viable Product)
- [ ] Wyświetlanie siły sygnału LTE (RSRP)
- [ ] Wyświetlanie typu sieci (4G/LTE)
- [ ] Wyświetlanie ruchu WAN (download/upload)
- [ ] Lista podłączonych urządzeń
- [ ] Graceful handling gdy router nieskonfigurowany

### Nice to have (v1.1)
- [ ] Historia sygnału (sparkline)
- [ ] Szczegółowe metryki (RSRQ, SNR)
- [ ] Sortowanie tabeli urządzeń
- [ ] Statystyki ruchu per urządzenie
- [ ] Powiadomienia o słabym sygnale
