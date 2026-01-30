# Pytania i niewyjaśnione kwestie

## 1. Pytania do użytkownika (wymagają odpowiedzi przed implementacją)

### 1.1 Konfiguracja routera

| # | Pytanie | Opcje | Domyślna |
|---|---------|-------|----------|
| Q1 | Jaki jest adres IP routera w sieci? | np. 192.168.0.1, 192.168.1.1 | 192.168.0.1 |
| Q2 | Czy hasło do routera jest domyślne czy zmienione? | - | - |
| Q3 | Czy chcesz używać HTTPS do komunikacji z routerem? | Tak/Nie | Nie |
| Q4 | Jaka jest wersja firmware routera? | Sprawdź w panelu | - |

### 1.2 Wymagania funkcjonalne

| # | Pytanie | Opcje | Impact |
|---|---------|-------|--------|
| Q5 | Czy chcesz widzieć historię sygnału (wykres)? | Tak/Nie | Wpływa na złożoność |
| Q6 | Czy potrzebujesz funkcji SMS (odczyt/wysyłanie)? | Tak/Nie | Osobna implementacja |
| Q7 | Jak często odświeżać dane routera? | 3s/5s/10s/30s | 5s rekomendowane |
| Q8 | Czy chcesz powiadomienia o słabym sygnale? | Tak/Nie | Dodatkowa logika |

### 1.3 UX Preferences

| # | Pytanie | Opcje | Rekomendacja |
|---|---------|-------|--------------|
| Q9 | Preferujesz zakładki czy rozszerzony dashboard? | Tabs / Extended / Hybrid | Tabs |
| Q10 | Czy tabela urządzeń powinna pokazywać wszystkie czy tylko aktywne? | Wszystkie/Aktywne/Wybór | Aktywne domyślnie |
| Q11 | Czy chcesz możliwość ukrywania urządzeń? | Tak/Nie | Nice to have |

## 2. Kwestie techniczne do zbadania

### 2.1 API TP-Link TL-MR100

| # | Kwestia | Status | Notatki |
|---|---------|--------|---------|
| T1 | Dokładne endpointy HTTP API | Do zbadania | Reverse engineering z biblioteki Python |
| T2 | Format autentykacji (token/session) | Do zbadania | AES CBC lub GCM |
| T3 | Rate limiting routera | Nieznany | Testować w praktyce |
| T4 | Czy router wspiera keep-alive | Nieznany | Może wymagać re-auth |

### 2.2 Kompatybilność

| # | Kwestia | Status | Notatki |
|---|---------|--------|---------|
| T5 | Różnice między firmware v1.x i v2.x | Do sprawdzenia | Biblioteka wspiera v2.0 |
| T6 | Czy inne routery TP-Link będą działać | Prawdopodobnie | Różne endpointy możliwe |

## 3. Decyzje architektoniczne do podjęcia

### D1: Implementacja klienta TP-Link

**Opcje:**
| Opcja | Opis | Pros | Cons |
|-------|------|------|------|
| A | Port biblioteki Python do TypeScript | Pełna kontrola, brak zależności | Czasochłonne, utrzymanie |
| B | Python subprocess | Szybkie, gotowe | Zależność Python, overhead |
| C | Python microservice | Separacja, elastyczność | Dodatkowy kontener |

**Rekomendacja:** Opcja A - port do TypeScript

**Pytanie:** Czy zgadzasz się z tym podejściem?

### D2: Obsługa błędów połączenia

**Opcje:**
| Opcja | Opis |
|-------|------|
| A | Retry z exponential backoff, potem fallback do ostatnich danych |
| B | Natychmiastowy error state, wymagaj manual retry |
| C | Background retry, UI pokazuje stale dane z timestamp "last updated" |

**Rekomendacja:** Opcja C

**Pytanie:** Jak chcesz obsługiwać sytuację gdy router jest czasowo niedostępny?

### D3: Przechowywanie historii

**Opcje:**
| Opcja | Opis |
|-------|------|
| A | In-memory (jak obecne metryki) - utrata przy restart |
| B | Plik JSON (persist między restartami) |
| C | SQLite (bardziej rozbudowane) |

**Rekomendacja:** Opcja A - spójność z resztą aplikacji

**Pytanie:** Czy historia powinna przetrwać restart aplikacji?

## 4. Otwarte kwestie designu

### UI/UX

| # | Kwestia | Propozycja |
|---|---------|------------|
| U1 | Kolor wskaźnika sygnału gdy brak danych | Szary z "?" |
| U2 | Format wyświetlania adresu MAC | Pełny vs skrócony (aa:bb:...ff) |
| U3 | Czy pokazywać hostname czy MAC gdy hostname pusty | MAC z prefixem "Unknown-" |
| U4 | Jednostki ruchu | Auto (B/KB/MB) vs zawsze MB |

### Bezpieczeństwo

| # | Kwestia | Propozycja |
|---|---------|------------|
| S1 | Gdzie przechowywać hasło routera | Zmienna środowiskowa (jak TOKENS) |
| S2 | Czy logować hasło | Nigdy - maskować w logach |
| S3 | Czy eksponować hasło przez API | Nie - tylko masked indicator |

## 5. Zależności zewnętrzne

### Do zainstalowania (backend)

```json
{
  "dependencies": {
    // Prawdopodobnie żadne nowe - użyjemy natywnego fetch/http
  }
}
```

### Do zainstalowania (frontend)

```json
{
  "dependencies": {
    // Prawdopodobnie żadne nowe - MUI Tabs już dostępne
  }
}
```

## 6. Priorytety pytań

### Blokujące (muszą być odpowiedziane przed startem)
1. Q1 - Adres IP routera
2. Q2 - Hasło do routera
3. Q9 - Preferowany layout UI

### Ważne (wpływają na scope)
4. Q5 - Historia sygnału
5. Q7 - Częstotliwość odświeżania
6. D1 - Architektura klienta

### Nice to have (można zdecydować później)
7. Q6 - Funkcje SMS
8. Q8 - Powiadomienia
9. D3 - Persistencja historii

---

## Następne kroki

Po odpowiedzi na pytania blokujące:
1. Finalizacja specyfikacji technicznej
2. Rozpoczęcie Fazy 1 (klient TP-Link)
3. Iteracyjna implementacja z code review
