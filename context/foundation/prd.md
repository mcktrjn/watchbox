---
project: "Watchbox"
version: 1
status: draft
created: 2026-06-27
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

# Watchbox — Product Requirements Document

## Vision & Problem Statement

Kolekcjoner zegarków poza domem ma na nadgarstku tylko jeden egzemplarz, a chciałby
mieć dostęp do całej swojej kolekcji w każdym miejscu i czasie. Dziś dane i zdjęcia
jego zegarków są rozproszone (głowa, arkusze, zdjęcia w telefonie, fora) i nie ma
jednego estetycznego, kompletnego miejsca, które trzymałoby zdjęcia i dane techniczne
wszystkich modeli. Co więcej, kolekcjoner nie wie, których zegarków realnie używa —
które nosi najczęściej, a które przez większość czasu leżą nieużywane — i nie ma
narzędzia, by to zmierzyć ani przeanalizować.

Wgląd, który czyni ten produkt wartym zbudowania: żadna istniejąca aplikacja nie łączy
wszystkich funkcji docelowego produktu (baza wiedzy, wirtualne pudełko, statystyki,
porównywarka, społeczność, doradca AI) — dostępne alternatywy są nieestetyczne i
niepełne. Dodatkowo planowany w przyszłości tracker mocowany do zegarka, zbierający
dane o noszeniu automatycznie, podniesie wartość całego rozwiązania; aplikacja jest
pierwszym krokiem w tym kierunku. MVP celowo zaczyna od modułu statystyk noszenia jako
funkcjonalności domenowej, bo pełna baza wiedzy wymaga pozyskania danych w skali
przekraczającej zakres MVP.

## User & Persona

**Primary persona:** kolekcjoner-entuzjasta zegarków z wieloma egzemplarzami w
kolekcji (na start obejmuje to także samego autora produktu). Sięga po produkt, gdy
chce przeglądać całą kolekcję poza domem oraz gdy chce zrozumieć i analizować, jak
realnie używa swoich zegarków.

## Success Criteria

### Primary

- Użytkownik przechodzi pełny przepływ pierwszej sesji: loguje się, dodaje zegarek
  (nazwa + zdjęcie), rejestruje co najmniej jedną sesję noszenia (data + godzina
  założenia i zdjęcia) i widzi wygenerowane statystyki noszenia (które zegarki nosi
  najczęściej / najrzadziej) w przedziale tydzień / miesiąc / rok.

### Secondary

- Brak osobnego kryterium nice-to-have — wcześniejszy kandydat „edycja/usuwanie sesji
  noszenia wstecz" został w fazie 4 awansowany przez użytkownika do must-have jako
  FR-010.

### Guardrails

- Estetyka interfejsu prezentującego zegarki i zdjęcia pozostaje wysokiej jakości —
  to kluczowa obietnica produktu; brzydki, niespójny UI jest regresją nawet jeśli
  cała funkcjonalność działa.

## User Stories

### US-01: Rejestracja noszenia i wgląd w statystyki

- **Given** zalogowany użytkownik z co najmniej jednym zegarkiem w kolekcji
- **When** wskazuje datę oraz godzinę założenia i godzinę zdjęcia (HH:MM) dla wybranego zegarka, a następnie otwiera widok statystyk
- **Then** widzi wykresy pokazujące, które zegarki nosi najczęściej/najrzadziej w wybranym przedziale (tydzień / miesiąc / rok), uwzględniające właśnie zarejestrowaną sesję

#### Acceptance Criteria

- Sesja noszenia wymaga daty oraz godziny założenia i godziny zdjęcia; godzina zdjęcia nie może być wcześniejsza niż godzina założenia.
- Statystyki uwzględniają zarówno sumaryczny czas noszenia, jak i liczbę sesji/dni.
- Zmiana przedziału (tydzień / miesiąc / rok) przelicza i odświeża wykresy.
- Brak zarejestrowanych sesji pokazuje stan pusty z wyjaśnieniem, a nie pusty wykres bez kontekstu.

## Functional Requirements

### Authentication

- FR-001: Użytkownik może założyć konto za pomocą adresu e-mail i hasła. Priority: must-have
  > Socrates: Kontrargument rozważony: „na v1 wystarczyłoby jedno zahardkodowane konto". Rozstrzygnięcie: zostaje — produkt jest wieloużytkownikowy z założenia, a rejestracja jest tania.
- FR-002: Użytkownik może zalogować się za pomocą adresu e-mail i hasła. Priority: must-have
  > Socrates: Kontrargument rozważony: „magic-link uwolniłby od przechowywania haseł". Rozstrzygnięcie: zostaje — e-mail+hasło jest świadomym wyborem użytkownika.
- FR-003: Użytkownik może się wylogować. Priority: must-have
  > Socrates: Kontrargument rozważony: „osobista apka rzadko potrzebuje wylogowania". Rozstrzygnięcie: zostaje — dostęp z wielu urządzeń wymaga jawnego wylogowania.

### Watch box

- FR-004: Użytkownik może dodać zegarek do swojej kolekcji, podając nazwę; zdjęcie jest opcjonalne. Priority: must-have
  > Socrates: Kontrargument przyjęty: „zdjęcie powinno być opcjonalne, by obniżyć tarcie dodawania". Rozstrzygnięcie: FR zmieniony — wymagana jest tylko nazwa, zdjęcie opcjonalne.
- FR-005: Użytkownik może przeglądać listę wszystkich zegarków w swojej kolekcji. Priority: must-have
  > Socrates: Kontrargument rozważony: „przy kilku zegarkach lista niewiele wnosi". Rozstrzygnięcie: zostaje — lista to główny widok przeglądania całej kolekcji „zawsze i wszędzie".
- FR-006: Użytkownik może zobaczyć szczegóły pojedynczego zegarka. Priority: must-have
  > Socrates: Kontrargument rozważony: „przy samej nazwie+zdjęciu szczegóły powielają kartę z listy". Rozstrzygnięcie: zostaje — widok szczegółów to miejsce na historię noszenia danego zegarka i przyszłe dane techniczne; w MVP może być minimalny.
- FR-007: Użytkownik może edytować nazwę i zdjęcie zegarka. Priority: must-have
  > Socrates: Kontrargument rozważony: „edycję można odroczyć (usuń+dodaj)". Rozstrzygnięcie: zostaje — usuwanie zegarka osierociłoby jego historię noszenia, więc edycja jest potrzebna.
- FR-008: Użytkownik może usunąć zegarek ze swojej kolekcji. Priority: must-have
  > Socrates: Kontrargument rozważony: „usunięcie osieroci historię noszenia/statystyki — może archiwizować?". Rozstrzygnięcie: zostaje jako jawne usunięcie; los powiązanych sesji noszenia przy usuwaniu → Open Questions.

### Wear tracking

- FR-009: Użytkownik może zarejestrować sesję noszenia zegarka, wskazując datę oraz godzinę założenia i godzinę zdjęcia (HH:MM). Priority: must-have
  > Socrates: Kontrargument rozważony: „ręczne godziny to tarcie; użytkownik może nie logować, a od tego zależy cała wartość statystyk". Rozstrzygnięcie: zostaje — ręczne wpisywanie jest świadomym wyborem MVP; automatyczny pomiar to przyszły tracker. Ryzyko dyscypliny logowania → Open Questions.
- FR-010: Użytkownik może edytować lub usunąć zarejestrowaną sesję noszenia. Priority: must-have
  > Socrates: Kontrargument rozważony: „edycja = usuń+dodaj". Rozstrzygnięcie: zostaje jako must-have (awansowany z nice-to-have) — poprawianie pomyłek wstecz jest kluczowe dla wiarygodności statystyk.

### Statistics

- FR-011: Użytkownik może zobaczyć wykresy statystyk pokazujące, które zegarki nosi najczęściej/najrzadziej w wybranym przedziale (tydzień / miesiąc / rok), mierzone zarówno sumarycznym czasem noszenia (godziny), jak i liczbą sesji/dni noszenia. Priority: must-have
  > Socrates: Kontrargument rozważony: „przy rzadkich, ręcznych danych wykresy mogą mylić lub być puste". Rozstrzygnięcie: zostaje — stan pusty jest jawnie obsłużony (US-01), a statystyki są domenową wartością MVP.

## Non-Functional Requirements

- Dane kolekcji i statystyki należące do jednego użytkownika nie są widoczne ani
  dostępne dla żadnego innego użytkownika.
- Lista kolekcji oraz przeliczenie i odświeżenie wykresów statystyk dają użytkownikowi
  ciągłą, widoczną informację zwrotną; postrzegana odpowiedź dla typowej kolekcji
  pozostaje płynna (cel: < 1 s p95 dla wyświetlenia listy i przeliczenia statystyk).
- Żaden zatwierdzony zegarek ani zarejestrowana sesja noszenia nie znika bez jawnej
  akcji usunięcia wykonanej przez użytkownika.

## Business Logic

Na podstawie ręcznie zarejestrowanych sesji noszenia (data oraz godzina założenia i
godzina zdjęcia) aplikacja oblicza i porządkuje zegarki według intensywności noszenia
w wybranym przedziale czasu, pokazując, które są noszone najczęściej, a które najrzadziej.

Wejściem reguły są sesje noszenia podawane przez użytkownika: dla wybranej daty
(bieżącej lub historycznej) godzina założenia i godzina zdjęcia danego zegarka.
Wyjściem jest uporządkowany ranking / rozkład noszenia kolekcji liczony w dwóch
ujęciach jednocześnie: sumaryczny czas noszenia (godziny) oraz liczba sesji/dni
noszenia. Użytkownik napotyka wynik w widoku statystyk jako wykresy prezentujące
najczęściej i najrzadziej noszone zegarki w wybranym przedziale (tydzień / miesiąc /
rok). To reguła obliczania/rankingu, nie zwykłe CRUD — wartość produktu w MVP polega
na decyzji, jaką aplikacja podejmuje za użytkownika (uszereguj kolekcję wg realnego
użytkowania).

## Access Control

Wieloużytkownikowy model z uwierzytelnianiem: rejestracja i logowanie za pomocą
adresu e-mail i hasła. Model ról jest płaski — istnieje jedna rola użytkownika; każdy
zalogowany użytkownik widzi i zarządza wyłącznie własną kolekcją i własnymi danymi
statystycznymi. Brak rozróżnienia admin/member/guest w MVP. Dane przechowywane są po
stronie serwera, aby umożliwić dostęp do całej kolekcji z dowolnego urządzenia
(kluczowe dla głównego scenariusza „cała kolekcja zawsze i wszędzie"). Niezalogowany
użytkownik nie ma dostępu do żadnych danych kolekcji.

## Non-Goals

MVP świadomie NIE obejmuje poniższych — pełna wizja produktu je zawiera, ale są poza
zakresem pierwszej wersji:

- **Baza wiedzy / auto-uzupełnianie danych i zdjęć z zewnętrznego źródła** — wymaga
  pozyskania danych w skali daleko przekraczającej MVP; w MVP zegarek to nazwa +
  opcjonalne zdjęcie wpisywane ręcznie.
- **Statystyki cen zegarków (retail/resale)** — zależą od bazy wiedzy, której nie ma w MVP.
- **Lista życzeń (wishlist)** — osobny moduł pełnej wersji.
- **Porównywarka modeli** — osobny moduł pełnej wersji.
- **Społeczność / udostępnianie kolekcji, listy życzeń, statystyk** — utrzymuje MVP
  jako produkt jednoosobowy/prywatny; brak warstwy społecznościowej.
- **Doradca AI** — osobny moduł pełnej wersji.
- **Automatyczny pomiar noszenia** — przyszła funkcjonalność oparta o osobny produkt;
  w MVP dane noszenia są wyłącznie ręczne.

## Open Questions

1. **Co dzieje się z zarejestrowanymi sesjami noszenia przy usunięciu zegarka (FR-008)?** — usuwać kaskadowo, archiwizować, czy blokować usunięcie, gdy istnieje historia? Owner: użytkownik. Do rozstrzygnięcia przed implementacją statystyk.
2. **Ryzyko dyscypliny logowania (FR-009).** — cała wartość statystyk zależy od regularnego ręcznego wpisywania sesji; brak danych = puste wykresy. Mitygacja docelowa: przyszły automatyczny pomiar noszenia (poza MVP). Owner: użytkownik.
