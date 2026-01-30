# Finalne decyzje - Router Indicator

**Data:** 2026-01-30
**Status:** ZATWIERDZONE - gotowe do implementacji

## 1. Konfiguracja routera

| Parametr | Wartość | Zmienna środowiskowa |
|----------|---------|---------------------|
| Adres IP routera | 192.168.0.1 (domyślna) | `ROUTER_IP` |
| Hasło | Konfigurowalne, domyślnie "admin" | `ROUTER_PASSWORD` |
| Username | admin | `ROUTER_USERNAME` |
| HTTPS | Nie | `ROUTER_HTTPS=false` |
| Firmware | Do sprawdzenia w runtime | - |

## 2. Wymagania funkcjonalne

| Feature | Decyzja | Notatki |
|---------|---------|---------|
| Historia sygnału (wykres) | TAK | Sparkline jak dla CPU/RAM |
| Funkcje SMS | NIE | Poza scope |
| Częstotliwość odświeżania | 5s | Konfigurowalne: `ROUTER_POLL_INTERVAL_MS` |
| Powiadomienia o słabym sygnale | NIE | Poza scope |

## 3. UX

| Aspekt | Decyzja |
|--------|---------|
| Layout | **Zakładki** (Tab "System" + Tab "Router") |
| Tabela urządzeń | Tylko **aktywne** urządzenia |
| Ukrywanie urządzeń | NIE |

## 4. Decyzje architektoniczne

### D1: Implementacja klienta TP-Link
**Wybór: Opcja B - Python subprocess**

```
┌─────────────────────────────────────────────────────────────┐
│                     Node.js Backend                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  RouterCollector                                      │  │
│  │  └─ spawn('python3', ['router_client.py', ...])      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓ JSON stdout
┌─────────────────────────────────────────────────────────────┐
│  router_client.py (Python script)                           │
│  ├─ Uses tplinkrouterc6u library                           │
│  ├─ Connects to router, fetches data                       │
│  └─ Outputs JSON to stdout                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓ HTTP
┌─────────────────────────────────────────────────────────────┐
│                   TP-Link TL-MR100                          │
└─────────────────────────────────────────────────────────────┘
```

**Zalety tego podejścia:**
- Wykorzystuje gotową, przetestowaną bibliotekę Python
- Szybsza implementacja
- Łatwiejsze utrzymanie (aktualizacje biblioteki)

**Wymagania:**
- Python 3.x w kontenerze Docker
- Pakiet `tplinkrouterc6u`

### D2: Obsługa błędów połączenia
**Wybór: Opcja C - Background retry z ostatnimi danymi**

- UI pokazuje ostatnie znane dane
- Timestamp "Last updated: X seconds ago"
- Wskaźnik "stale data" gdy dane starsze niż 30s
- Background retry co interwał polling

### D3: Przechowywanie historii
**Wybór: Opcja A - In-memory**

- Spójne z resztą aplikacji
- Historia utracona przy restart
- Rozmiar bufora: `ROUTER_HISTORY_SIZE` (domyślnie 60 próbek = 5min przy 5s polling)

## 5. UI/UX szczegóły

| Aspekt | Decyzja |
|--------|---------|
| Wskaźnik sygnału - brak danych | Szary z "?" |
| Format MAC | Pełny (aa:bb:cc:dd:ee:ff) |
| Hostname pusty | Pokazuj "Unknown-XXXX" (ostatnie 4 znaki MAC) |
| Jednostki ruchu | Auto (B → KB → MB) |

## 6. Bezpieczeństwo

| Aspekt | Decyzja |
|--------|---------|
| Przechowywanie hasła | Zmienna środowiskowa `ROUTER_PASSWORD` |
| Logowanie hasła | NIGDY - maskować jako `***` |
| Ekspozycja przez API | NIE - tylko informacja czy skonfigurowane |

## 7. Zmienne środowiskowe (finalne)

```bash
# Router configuration (optional feature)
ENABLE_ROUTER_STATS=false              # Feature flag
ROUTER_IP=192.168.0.1                  # Router IP address
ROUTER_PASSWORD=admin                  # Router admin password
ROUTER_USERNAME=admin                  # Router username
ROUTER_HTTPS=false                     # Use HTTPS
ROUTER_POLL_INTERVAL_MS=5000           # Polling interval (min 3000)
ROUTER_HISTORY_SIZE=60                 # History buffer size
```

## 8. Scope MVP

### W scope:
- Jakość sygnału LTE (RSRP, RSRQ, SNR) z wykresem historii
- Typ sieci (4G/LTE/3G)
- Ruch WAN (download/upload) z wykresem
- Lista aktywnych urządzeń (hostname, IP, typ, ruch)
- Status połączenia (operator, uptime, WAN IP)
- System zakładek w UI

### Poza scope:
- Funkcje SMS
- Powiadomienia
- Ukrywanie urządzeń
- Persistencja historii
- Obsługa innych routerów (tylko TL-MR100)
