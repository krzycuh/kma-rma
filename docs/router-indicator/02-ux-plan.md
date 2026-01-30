# Plan UX: Wyświetlanie danych z routera

## 1. Analiza obecnego UI

Aktualny dashboard zawiera:
- **3 karty metryczne w rzędzie:** CPU, RAM, Network
- **1 karta pełnej szerokości:** Containers

Layout jest responsywny (1 kolumna mobile, 3 kolumny desktop).

## 2. Propozycje integracji danych routera

### Opcja A: Dedykowana zakładka "Router" (REKOMENDOWANA)

**Opis:**
Dodanie systemu zakładek (tabs) do dashboardu:
- Tab 1: "System" (obecny widok: CPU, RAM, Network, Containers)
- Tab 2: "Router" (nowy widok z danymi routera)

**Zalety:**
- Czyste rozdzielenie danych systemowych od sieciowych
- Nie zaśmieca głównego widoku
- Łatwe do rozbudowy o kolejne zakładki w przyszłości
- Użytkownik świadomie przełącza kontekst

**Wady:**
- Wymaga kliknięcia aby zobaczyć dane routera
- Kluczowe problemy (słaby sygnał) mogą być przeoczone

**Mitygacja wad:**
- Dodać mały wskaźnik stanu na tabie (zielony/żółty/czerwony)
- Opcjonalnie: mini-widget sygnału na głównym widoku

```
┌─────────────────────────────────────────────────────┐
│   Raspberry Pi Manager                              │
├──────────────┬──────────────────────────────────────┤
│  [System]    │  [Router 🟢]                         │
├──────────────┴──────────────────────────────────────┤
│                                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐ │
│  │ Signal  │  │ Traffic │  │ Connected Devices   │ │
│  │ Quality │  │ WAN     │  │ (lista)             │ │
│  │ ████░░  │  │ ↓ 2.5MB │  │                     │ │
│  │ -85 dBm │  │ ↑ 0.3MB │  │ • iPhone (192...)   │ │
│  │ 4G LTE  │  │         │  │ • Laptop (192...)   │ │
│  └─────────┘  └─────────┘  │ • RPi (192...)      │ │
│                            └─────────────────────┘ │
│  ┌─────────────────────────────────────────────────┤
│  │ Connection Details                              │
│  │ Operator: Plus  │ Uptime: 2d 5h │ SIM: OK     │
│  └─────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────┘
```

### Opcja B: Rozszerzenie głównego widoku

**Opis:**
Dodanie 4. karty "Router" obok CPU, RAM, Network.

```
┌─────────────────────────────────────────────────────────────────┐
│   Raspberry Pi Manager                                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐│
│  │  CPU    │  │  RAM    │  │ Network │  │ Router              ││
│  │ 12.5%   │  │ 412MB   │  │ ↓1.2MB  │  │ 🟢 4G LTE          ││
│  │ 45.2°C  │  │         │  │ ↑0.1MB  │  │ -85dBm │ 3 devices ││
│  │ ▃▅▂▄▃▅▇ │  │ ▃▅▂▄▃▅▇ │  │ ▃▅▂▄▃▅▇ │  │ ▃▅▂▄▃▅▇            ││
│  └─────────┘  └─────────┘  └─────────┘  └─────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┤
│  │ Containers                                                   │
│  └─────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

**Zalety:**
- Wszystko widoczne na jednym ekranie
- Szybki dostęp do kluczowych informacji

**Wady:**
- Mała przestrzeń na szczegóły
- 4 kolumny mogą być ciasne na mniejszych ekranach
- Brak miejsca na listę urządzeń

### Opcja C: Hybrydowa

**Opis:**
- Mały widget sygnału na głównym widoku (w karcie Network lub osobny)
- Pełne szczegóły w modalnym oknie / drawer

**Zalety:**
- Kompromis między widocznością a szczegółowością

**Wady:**
- Dodatkowa złożoność UI
- Modal może być irytujący przy częstym sprawdzaniu

## 3. Rekomendacja: Opcja A (Zakładki)

### Uzasadnienie:
1. **Skalowalność** - łatwo dodać kolejne zakładki (np. "Logs", "Settings")
2. **Czytelność** - każda zakładka ma swój kontekst
3. **Responsywność** - więcej miejsca na dane routera
4. **Spójność** - wskaźnik stanu na tabie informuje o problemach

### Proponowany układ zakładki "Router":

```
┌─────────────────────────────────────────────────────────────────┐
│                        Router Status                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │   Signal Quality    │  │    WAN Traffic      │              │
│  │   ▓▓▓▓▓▓░░░░ 65%   │  │   ↓ 2.54 MB/s      │              │
│  │                     │  │   ↑ 0.34 MB/s      │              │
│  │   RSRP: -85 dBm    │  │                     │              │
│  │   RSRQ: -12 dB     │  │   ▃▅▂▄▃▅▇▂▄▃       │              │
│  │   SNR:  15 dB      │  │   ▂▃▁▂▁▂▃▁▂▁       │              │
│  │                     │  │                     │              │
│  │   Network: 4G LTE  │  │   Session: 2.4 GB   │              │
│  │   Operator: Plus   │  │   Uptime: 2d 5h 12m │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   Connected Devices (5)                     ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │  Device              │ IP Address    │ Type   │ Traffic    ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │  iPhone-John         │ 192.168.0.101 │ WiFi   │ ↓2.1 ↑0.3 ││
│  │  MacBook-Pro         │ 192.168.0.102 │ WiFi   │ ↓0.5 ↑0.1 ││
│  │  raspberrypi         │ 192.168.0.100 │ Wired  │ ↓1.2 ↑0.8 ││
│  │  Smart-TV            │ 192.168.0.105 │ WiFi   │ ↓5.2 ↑0.0 ││
│  │  Unknown-Device      │ 192.168.0.110 │ WiFi   │ ↓0.0 ↑0.0 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  SIM: OK │ WAN IP: 83.x.x.x │ Firmware: 1.4.0             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## 4. Komponenty UI

### 4.1 Signal Quality Card

**Elementy:**
- Progress bar z kolorowym gradientem (czerwony→żółty→zielony)
- Wartości liczbowe RSRP, RSRQ, SNR
- Ikona typu sieci (4G/LTE/3G)
- Nazwa operatora

**Kolory progu:**
- Zielony: Doskonały/Dobry sygnał
- Żółty: Średni sygnał
- Czerwony: Słaby sygnał

### 4.2 WAN Traffic Card

**Elementy:**
- Download/Upload bieżący
- Sparkline wykres (jak w obecnej karcie Network)
- Całkowity transfer sesji
- Uptime połączenia

### 4.3 Connected Devices Table

**Elementy:**
- Tabela z sortowaniem
- Ikony typu połączenia (WiFi/Ethernet)
- Mini-wykres ruchu per urządzenie (opcjonalnie)
- Podświetlenie aktywnych urządzeń

### 4.4 Status Bar

**Elementy:**
- Status SIM
- Zewnętrzny IP
- Wersja firmware
- Czas ostatniej aktualizacji

## 5. Stany UI

### 5.1 Ładowanie
- Skeleton loaders w miejscu kart
- Spinner w zakładce

### 5.2 Błąd połączenia
- Alert z komunikatem błędu
- Przycisk "Retry"
- Zachowanie ostatnich znanych danych

### 5.3 Router nieskonfigurowany
- Informacja o konieczności konfiguracji
- Link do ustawień lub instrukcja

### 5.4 Router niedostępny
- Ikona offline
- Czas ostatniego połączenia
- Przycisk retry

## 6. Responsywność

### Desktop (>768px)
- 2 karty w rzędzie (Signal, Traffic)
- Tabela urządzeń pełnej szerokości

### Mobile (<768px)
- Karty jedna pod drugą
- Tabela urządzeń z horizontal scroll
- Zakładki jako dropdown lub compact tabs

## 7. Accessibility

- ARIA labels dla wskaźników
- Alternatywny tekst dla kolorów (nie tylko kolor jako informacja)
- Keyboard navigation między zakładkami
- Focus visible dla interaktywnych elementów
