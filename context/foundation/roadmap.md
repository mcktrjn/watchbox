---
project: "Watchbox"
version: 1
status: draft
created: 2026-06-30
updated: 2026-06-30
prd_version: 1
main_goal: speed
top_blocker: decisions
---

# Roadmap: Watchbox

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Kolekcjoner zegarków poza domem chce mieć dostęp do całej swojej kolekcji w każdym miejscu i czasie — a istniejące aplikacje są nieestetyczne i niepełne. MVP waliduje domenową hipotezę produktu: czy śledzenie sesji noszenia i wizualizacja statystyk (które zegarki noszę najczęściej / najrzadziej) są wystarczająco użyteczne, by uzasadnić dalszy rozwój aplikacji. Estetyka interfejsu jest traktowana jako kluczowa obietnica produktu — nie jako opcjonalne ulepszenie.

## North star

**S-05: widok statystyk noszenia** — pierwsza scena end-to-end, która udowadnia, że wear-tracking jako pomysł na produkt działa: użytkownik rejestruje sesje noszenia i widzi ranking swojej kolekcji według intensywności noszenia.

> „North star" oznacza tu: najmniejszy kompletny przepływ od danych do wizualizacji, którego udane dostarczenie potwierdziłoby główną hipotezę produktu — że statystyki noszenia zegarków są użyteczne i warte dalszego rozwijania. Slice umieszczony jak najwcześniej w kolejności, bo wszystko inne ma wartość tylko wtedy, gdy ten przepływ działa.

## At a glance

| ID   | Change ID                 | Outcome (użytkownik może …)                                                           | Prerequisites          | PRD refs                               | Status   |
| ---- | ------------------------- | ------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------- | -------- |
| F-01 | `database-schema`         | (foundation) tabele `watches` i `wear_sessions` z RLS i migracją wdrożone             | —                      | FR-004, FR-008, FR-009, FR-010, FR-011 | ready    |
| S-01 | `auth-flow`               | zarejestrować konto, zalogować się i wylogować; niezalogowany jest przekierowany      | —                      | FR-001, FR-002, FR-003, US-01          | ready    |
| S-02 | `watch-collection-view`   | dodać zegarek do kolekcji, przeglądać listę i zobaczyć szczegóły pojedynczego zegarka | F-01, S-01             | FR-004, FR-005, FR-006, US-01          | proposed |
| S-03 | `watch-collection-manage` | edytować i usunąć zegarek z kolekcji                                                  | S-02                   | FR-007, FR-008, US-01                  | proposed |
| S-04 | `wear-session-tracking`   | zarejestrować, edytować i usunąć sesję noszenia zegarka                               | F-01, S-01, S-02       | FR-009, FR-010, US-01                  | proposed |
| S-05 | `wear-statistics`         | zobaczyć wykresy statystyk noszenia w wybranym przedziale (tydzień / miesiąc / rok)   | F-01, S-01, S-02, S-04 | FR-011, US-01                          | blocked  |

## Baseline

Co jest już na miejscu w codebase na dzień 2026-06-30 (auto-zbadane + potwierdzone przez użytkownika).
Foundations poniżej zakładają obecność tych warstw i NIE tworzą ich od nowa.

- **Frontend:** present — Astro v6.3.1, React v19, Tailwind v4, shadcn/ui (New York style, `components.json` + `src/components/ui/`)
- **Backend / API:** present — Astro API routes w `src/pages/api/auth/` (signin, signout, signup)
- **Data:** partial — Supabase PostgreSQL skonfigurowane (`@supabase/supabase-js`, `supabase/config.toml`); brak migracji dla tabel domenowych (`watches`, `wear_sessions`)
- **Auth:** present — `@supabase/ssr` w `src/lib/supabase.ts`, middleware auth w `src/middleware.ts` (chroni `/dashboard`), komponenty auth w `src/components/auth/`
- **Deploy / infra:** present — Cloudflare Workers (`wrangler.jsonc`), CI/CD: `.github/workflows/ci.yml` (auto-deploy na main)
- **Observability:** absent — brak biblioteki logowania/tracingu; wrangler observability flag włączona, ale bez instrumentacji kodu

## Foundations

### F-01: Schemat bazy danych

- **Outcome:** (foundation) tabele `watches` i `wear_sessions` z polityką RLS (izolacja per-user) i migracją wdrożoną w Supabase; prowizoryczna kaskada ON DELETE CASCADE przy usuwaniu zegarka.
- **Change ID:** `database-schema`
- **PRD refs:** FR-004, FR-008, FR-009, FR-010, FR-011; NFR izolacji danych użytkownika i trwałości danych
- **Unlocks:** S-02 (watches CRUD wymaga tabeli `watches`), S-04 (wear tracking wymaga tabeli `wear_sessions`), S-05 (statystyki wymagają obu tabel z poprawnym RLS)
- **Prerequisites:** —
- **Parallel with:** S-01
- **Blockers:** —
- **Unknowns:** OQ-1 (kaskada vs archiwizacja vs blokada przy usunięciu zegarka — prowizoryczna decyzja: CASCADE; finalna decyzja wymagana przed `/10x-plan wear-statistics`) — Owner: użytkownik. Block: no.
- **Risk:** prowizoryczna kaskada CASCADE upraszcza schemat MVP; zmiana modelu po wdrożeniu S-04 byłaby kosztowna — OQ-1 powinno być rozstrzygnięte przed otwarciem S-05
- **Status:** ready

## Slices

### S-01: Przepływ uwierzytelniania

- **Outcome:** użytkownik może założyć konto e-mail+hasło, zalogować się i wylogować; niezalogowany użytkownik jest automatycznie przekierowany na stronę logowania
- **Change ID:** `auth-flow`
- **PRD refs:** FR-001, FR-002, FR-003, US-01
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** scaffold auth (`src/pages/api/auth/`, `src/components/auth/`, `src/middleware.ts`) jest obecny w baseline; ryzyko to niezweryfikowane zachowanie end-to-end z prawdziwym Supabase na Cloudflare Workers runtime — należy zweryfikować przed przejściem do S-02
- **Status:** ready

### S-02: Kolekcja zegarków — przeglądanie

- **Outcome:** użytkownik może dodać zegarek do kolekcji (podając nazwę; zdjęcie opcjonalne), przeglądać listę wszystkich swoich zegarków i zobaczyć szczegóły pojedynczego zegarka
- **Change ID:** `watch-collection-view`
- **PRD refs:** FR-004, FR-005, FR-006, US-01
- **Prerequisites:** F-01, S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** estetyka widoku listy zegarków (zdjęcia, karty) jest kluczową obietnicą produktu — guardrail PRD mówi, że brzydki UI jest regresją nawet przy działającej funkcjonalności; shadcn/ui jest skonfigurowane i musi być użyte spójnie
- **Status:** proposed

### S-03: Kolekcja zegarków — zarządzanie

- **Outcome:** użytkownik może edytować nazwę i zdjęcie istniejącego zegarka oraz usunąć zegarek z kolekcji
- **Change ID:** `watch-collection-manage`
- **PRD refs:** FR-007, FR-008, US-01
- **Prerequisites:** S-02
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:**
  - OQ-1 (co dzieje się z sesjami noszenia przy usunięciu zegarka — CASCADE / archiwizacja / blokada) — Owner: użytkownik. Block: no (prowizoryczna kaskada wystarczy do planowania S-03; finalna decyzja wymagana przed otwarciem S-05).
- **Risk:** edycja jest must-have, bo usunięcie zegarka osierociłoby jego historię noszenia (motywacja z PRD dla FR-007); finalna decyzja OQ-1 powinna być zapisana jako explicit business rule przed wdrożeniem S-05
- **Status:** proposed

### S-04: Rejestracja sesji noszenia

- **Outcome:** użytkownik może zarejestrować sesję noszenia zegarka (wskazując datę, godzinę założenia i godzinę zdjęcia w formacie HH:MM), a następnie edytować lub usunąć istniejącą sesję
- **Change ID:** `wear-session-tracking`
- **PRD refs:** FR-009, FR-010, US-01
- **Prerequisites:** F-01, S-01, S-02
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** walidacja reguły biznesowej (godzina zdjęcia ≥ godzina założenia) musi być wyegzekwowana po stronie serwera, nie tylko po stronie klienta; cała wartość S-05 zależy od regularności ręcznego wpisywania sesji przez użytkownika (OQ-2)
- **Status:** proposed

### S-05: Statystyki noszenia

- **Outcome:** użytkownik może zobaczyć wykresy pokazujące, które zegarki nosi najczęściej / najrzadziej w wybranym przedziale (tydzień / miesiąc / rok), w dwóch ujęciach: sumaryczny czas noszenia (godziny) i liczba sesji/dni noszenia
- **Change ID:** `wear-statistics`
- **PRD refs:** FR-011, US-01
- **Prerequisites:** F-01, S-01, S-02, S-04
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - OQ-1 (co dzieje się z sesjami noszenia przy usunięciu zegarka) — Owner: użytkownik. Block: yes (algorytm rankingu i zapytania statystyk muszą być spójne z finalną decyzją dotyczącą kaskady / archiwizacji; PRD §Open Questions stanowi: „do rozstrzygnięcia przed implementacją statystyk").
- **Risk:** pusty stan (brak zarejestrowanych sesji) musi być zaprojektowany świadomie — US-01 acceptance criteria wymagają stanu pustego z wyjaśnieniem, nie pustego wykresu; cel wydajności < 1s p95 dla przeliczenia statystyk dla typowej kolekcji
- **Status:** blocked

## Backlog Handoff

| Roadmap ID | Change ID                 | Suggested issue title                                           | Ready for `/10x-plan` | Notes                                                                |
| ---------- | ------------------------- | --------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------- |
| F-01       | `database-schema`         | Set up watches & wear_sessions schema with RLS                  | yes                   | Uruchom `/10x-plan database-schema`                                  |
| S-01       | `auth-flow`               | Verify & complete email+password auth flow (Cloudflare Workers) | yes                   | Uruchom `/10x-plan auth-flow` (równolegle z F-01)                    |
| S-02       | `watch-collection-view`   | Watch collection: add, list, view detail                        | no                    | Wymaga F-01 i S-01                                                   |
| S-03       | `watch-collection-manage` | Watch collection: edit and delete                               | no                    | Wymaga S-02; rozstrzygnij OQ-1 przed wdrożeniem                      |
| S-04       | `wear-session-tracking`   | Wear session: register, edit, delete                            | no                    | Wymaga F-01, S-01, S-02                                              |
| S-05       | `wear-statistics`         | Wear statistics charts (week / month / year)                    | no                    | Zablokowany na OQ-1 — rozstrzygnij przed `/10x-plan wear-statistics` |

## Open Roadmap Questions

1. **Co dzieje się z zarejestrowanymi sesjami noszenia przy usunięciu zegarka (OQ-1)?** — Owner: użytkownik. Block: S-05 (yes). Opcje: (a) kaskada — usuń sesje razem z zegarkiem (standard MVP, najprościej); (b) archiwizacja — zachowaj sesje, oznacz zegarek jako usunięty; (c) blokada — nie pozwól na usunięcie zegarka, który ma historię noszenia. Rozstrzygnięcie odblokuje S-05 i pozwoli zamknąć OQ-1 w S-03.
2. **Ryzyko dyscypliny logowania (OQ-2)** — cała wartość S-05 zależy od regularności ręcznego wpisywania sesji noszenia; brak wpisów = puste wykresy = brak sygnału. Owner: użytkownik. Block: none (ryzyko zaakceptowane świadomie; mitygacja docelowa to hardware-tracker poza zakresem MVP).

## Parked

- **Baza wiedzy / auto-uzupełnianie danych i zdjęć zegarków** — Why parked: PRD §Non-Goals — wymaga pozyskania danych w skali przekraczającej MVP.
- **Statystyki cen zegarków (retail/resale)** — Why parked: PRD §Non-Goals — zależą od bazy wiedzy, której nie ma w MVP.
- **Lista życzeń (wishlist)** — Why parked: PRD §Non-Goals — osobny moduł pełnej wersji.
- **Porównywarka modeli** — Why parked: PRD §Non-Goals — osobny moduł pełnej wersji.
- **Społeczność / udostępnianie kolekcji, statystyk** — Why parked: PRD §Non-Goals — utrzymuje MVP jako produkt prywatny; brak warstwy społecznościowej.
- **Doradca AI** — Why parked: PRD §Non-Goals — osobny moduł pełnej wersji.
- **Automatyczny pomiar noszenia (hardware-tracker)** — Why parked: PRD §Non-Goals — przyszły produkt sprzętowy; w MVP dane noszenia wyłącznie ręczne.
- **Observability / monitoring kodu** — Why parked: cel `speed`, brak must-have FR wymagającego monitoringu; żaden slice nie blokuje się na tej warstwie; można dodać po MVP.

## Done

(Empty on first generation. `/10x-archive` appends entries here — and flips that item's `Status` to `done` — when a change whose `Change ID` matches a roadmap item is archived.)
