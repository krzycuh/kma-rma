# Research: Dane z routera TP-Link TL-MR100

## 1. Specyfikacja routera

**Model:** TP-Link TL-MR100
**Typ:** Wireless N 4G LTE Router (300Mbps)
**Kluczowe cechy:**
- Modem LTE Cat4 (do 150 Mbps download / 50 Mbps upload)
- WiFi 2.4GHz 802.11n
- 2x porty LAN, 1x port WAN/LAN
- Slot na kartę SIM

## 2. Metody dostępu do danych

### 2.1 Biblioteka Python: `tplinkrouterc6u`

**Status:** REKOMENDOWANA - TL-MR100 v2.0 jest na liście wspieranych urządzeń

**Instalacja:**
```bash
pip install tplinkrouterc6u
```

**Klienty dla routerów MR:**
- `TPLinkMRClient` - dla starszych firmware (AES CBC)
- `TPLinkMRClientGCM` - dla nowszych firmware (AES GCM)

**Źródła:**
- [GitHub - AlexandrErohin/TP-Link-Archer-C6U](https://github.com/AlexandrErohin/TP-Link-Archer-C6U)
- [PyPI - tplinkrouterc6u](https://pypi.org/project/tplinkrouterc6u/)

### 2.2 SNMP

**Status:** NIEDOSTĘPNE - router konsumencki, nie obsługuje SNMP

### 2.3 Oficjalne API TP-Link

**Status:** BRAK - TP-Link nie udostępnia oficjalnego API dla routerów konsumenckich

## 3. Dostępne dane z biblioteki `tplinkrouterc6u`

### 3.1 Status LTE (`get_lte_status()`)

| Metryka | Opis | Przydatność |
|---------|------|-------------|
| **Network Type** | Typ sieci (GSM, WCDMA, 4G LTE, 4G+ LTE) | Wysoka - pokazuje jakość połączenia |
| **RSRP** | Reference Signal Received Power (dBm) | Wysoka - siła sygnału |
| **RSRQ** | Reference Signal Received Quality (dB) | Wysoka - jakość sygnału |
| **SNR/SINR** | Signal-to-Noise Ratio (dB) | Wysoka - czystość sygnału |
| **SIM Status** | Status karty SIM | Średnia - diagnostyka problemów |
| **ISP Name** | Nazwa operatora | Niska - informacyjna |
| **Download Speed** | Bieżąca prędkość pobierania | Wysoka - aktywność sieci |
| **Upload Speed** | Bieżąca prędkość wysyłania | Wysoka - aktywność sieci |
| **Total RX/TX Bytes** | Całkowity transfer | Średnia - statystyki zużycia |
| **Unread SMS Count** | Liczba nieprzeczytanych SMS | Niska - powiadomienia |

**Interpretacja sygnału LTE:**

| RSRP (dBm) | RSRQ (dB) | SNR (dB) | Jakość |
|------------|-----------|----------|--------|
| > -80 | > -10 | > 20 | Doskonała |
| -80 do -90 | -10 do -15 | 13 do 20 | Dobra |
| -90 do -100 | -15 do -20 | 0 do 13 | Średnia |
| < -100 | < -20 | < 0 | Słaba |

**Typy sieci (enum):**
```
0: "No Service"
1: "GSM"
2: "WCDMA"
3: "4G LTE"
4: "TD-SCDMA"
5: "CDMA 1x"
6: "CDMA 1x Ev-Do"
7: "4G+ LTE"
```

**Statusy SIM:**
```
0: "No SIM card detected or SIM card error"
1: "No SIM card detected"
2: "SIM card error"
3: "SIM card prepared"
4: "SIM locked"
5: "SIM unlocked. Authentication succeeded"
6: "PIN locked"
7: "SIM card is locked permanently"
8: "Suspension of transmission"
9: "Unopened"
```

### 3.2 Podłączone urządzenia (`get_status()`)

| Metryka | Opis | Przydatność |
|---------|------|-------------|
| **Wired Clients** | Liczba urządzeń kablowych | Średnia |
| **WiFi Clients** | Liczba urządzeń WiFi | Wysoka |
| **Guest Clients** | Liczba urządzeń gości | Niska |
| **Total Clients** | Całkowita liczba urządzeń | Wysoka |
| **Device List** | Lista wszystkich urządzeń | Wysoka |

**Dane o urządzeniu:**
- MAC address
- IP address
- Hostname
- Connection type (2.4G, 5G, wired)
- Signal strength (dla WiFi)
- Download/Upload speed
- Packets sent/received
- Active/inactive status

### 3.3 Status systemu (`get_status()`)

| Metryka | Opis | Przydatność |
|---------|------|-------------|
| **CPU Usage** | Użycie CPU routera (0-1) | Średnia |
| **Memory Usage** | Użycie RAM routera (0-1) | Średnia |
| **WiFi 2.4G Enable** | Status WiFi | Niska |
| **Guest WiFi Enable** | Status sieci gości | Niska |

### 3.4 Informacje sieciowe (`get_ipv4_status()`)

| Metryka | Opis | Przydatność |
|---------|------|-------------|
| **WAN IP** | Adres IP zewnętrzny | Średnia |
| **LAN IP** | Adres IP wewnętrzny | Niska |
| **Gateway** | Brama domyślna | Niska |
| **DNS** | Serwery DNS | Niska |
| **Connection Uptime** | Czas połączenia | Średnia |

### 3.5 Firmware (`get_firmware()`)

| Metryka | Opis | Przydatność |
|---------|------|-------------|
| **Hardware Version** | Wersja sprzętu | Niska |
| **Firmware Version** | Wersja oprogramowania | Niska |
| **Model** | Model routera | Niska |

### 3.6 Funkcje SMS (`get_sms()`, `send_sms()`)

| Funkcja | Opis | Przydatność |
|---------|------|-------------|
| **Get SMS** | Odczyt wiadomości SMS | Niska (opcjonalna) |
| **Send SMS** | Wysyłanie SMS | Niska (opcjonalna) |
| **Unread Count** | Liczba nieprzeczytanych | Niska |

## 4. Rekomendowane metryki do wyświetlania

### 4.1 Priorytet WYSOKI (kluczowe dla diagnostyki)

1. **Jakość sygnału LTE**
   - RSRP, RSRQ, SNR jako wskaźniki graficzne
   - Typ sieci (4G/LTE/3G)
   - Kolorowy indykator jakości

2. **Ruch sieciowy WAN**
   - Download/Upload bieżący (z routera)
   - Trend historyczny

3. **Podłączone urządzenia**
   - Liczba aktywnych urządzeń
   - Lista z nazwami i adresami IP

### 4.2 Priorytet ŚREDNI (przydatne)

4. **Status połączenia**
   - Czas połączenia (uptime)
   - Operator (ISP)
   - Status SIM

5. **Zużycie danych**
   - Total downloaded/uploaded (od restartu)

### 4.3 Priorytet NISKI (opcjonalne)

6. **Status routera**
   - CPU/RAM routera
   - Wersja firmware

7. **SMS**
   - Liczba nieprzeczytanych wiadomości

## 5. Ograniczenia i ryzyka

### 5.1 Techniczne

| Ryzyko | Opis | Mitygacja |
|--------|------|-----------|
| **Sesja jednokrotna** | Web interface wspiera tylko 1 użytkownika | Dedykowana sesja dla RMA, krótkie requesty |
| **Brak SSE** | Dane przez polling | Polling co 5-10 sekund |
| **Zmiana firmware** | Aktualizacja może zepsuć API | Pinowanie wersji firmware, monitoring błędów |
| **Szyfrowanie** | Różne tryby (CBC/GCM) | Auto-detekcja przez bibliotekę |

### 5.2 Sieciowe

| Ryzyko | Opis | Mitygacja |
|--------|------|-----------|
| **Timeout** | Router może nie odpowiadać | Timeout + retry logic |
| **Błędy auth** | Nieprawidłowe hasło | Jasny komunikat błędu |

## 6. Wymagania konfiguracyjne

Użytkownik będzie musiał podać:
- `ROUTER_IP` - adres IP routera (domyślnie 192.168.0.1 lub 192.168.1.1)
- `ROUTER_PASSWORD` - hasło do panelu administracyjnego
- `ROUTER_USERNAME` - nazwa użytkownika (domyślnie "admin")

Opcjonalnie:
- `ROUTER_HTTPS` - czy używać HTTPS (wymaga włączenia w routerze)
- `ROUTER_POLL_INTERVAL` - interwał odpytywania (domyślnie 5000ms)

## 7. Źródła

- [tplinkrouterc6u - PyPI](https://pypi.org/project/tplinkrouterc6u/)
- [TP-Link-Archer-C6U - GitHub](https://github.com/AlexandrErohin/TP-Link-Archer-C6U)
- [TP-Link Community - API Discussion](https://community.tp-link.com/us/home/forum/topic/202310)
- [Paessler KB - TP-Link Monitoring](https://kb.paessler.com/en/topic/65127)
