# Watch Collection Manage — Plan Brief

> Full plan: `context/changes/watch-collection-manage/plan.md`

## What & Why

Użytkownik może edytować nazwę i zdjęcie istniejącego zegarka oraz usunąć zegarek z kolekcji (soft delete). To trzeci slice roadmapy (S-03), domykający CRUD kolekcji przed przejściem do śledzenia sesji noszenia (S-04) i statystyk (S-05). Usunięcie jest miękkie — dane zegarka i jego historia noszenia pozostają w bazie, ale znikają z widoków aplikacji.

## Starting Point

S-02 (`watch-collection-view`) dostarczył grid kolekcji, stronę szczegółów i dialog dodawania. Istnieje `watches` API z `GET` (lista + pojedynczy) i `POST` (dodawanie), Storage bucket `watch-photos` z RLS, oraz `AddWatchDialog` jako wzorzec dla dialogu edycji. Brakuje `PUT`, `DELETE`, kolumny `deleted_at` i jakichkolwiek przycisków akcji w UI.

## Desired End State

Zalogowany użytkownik wchodzi na `/collection/[id]`, klika „Edit” — otwiera się modal z obecną nazwą i zdjęciem, może zmienić jedno lub oba, zatwierdza — strona szczegółów odświeża się. Klika „Delete” — dialog prosi o potwierdzenie, po zatwierdzeniu wraca na `/collection`, a zegarek znika z gridu. W bazie zegarek ma ustawione `deleted_at`, sesje noszenia nietknięte.

## Key Decisions Made

| Decyzja                     | Wybór                                              | Dlaczego                                                                                | Źródło  |
| --------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- | ------- |
| Strategia usuwania          | Soft delete (`deleted_at`)                         | Zachowuje historię noszenia dla statystyk; OQ-1 rozstrzygnięty na korzyść archiwizacji  | Roadmap |
| FK `wear_sessions.watch_id` | `ON DELETE NO ACTION`                              | Zapobiega przypadkowej kaskadzie przy hard-delete; soft-delete nie używa SQL DELETE     | Plan    |
| UX usuwania                 | Dialog potwierdzenia                               | Chroni przed przypadkowym usunięciem — standardowy wzorzec dla destrukcyjnych akcji     | Plan    |
| UX edycji                   | Modal `EditWatchDialog` (osobny komponent)         | Spójny z `AddWatchDialog`, izoluje stan formularza, czytelna separacja create vs update | Plan    |
| Zdjęcie przy edycji         | Podmień plik — usuń stary z bucketa                | Nie zaśmiecamy Storage; best-effort (awaria usuwania nie psuje danych)                  | Plan    |
| Zdjęcie przy delete         | Zostaw plik w Storage                              | Soft delete jest potencjalnie odwracalny; przy skali MVP miejsce nie jest problemem     | Plan    |
| Przyciski akcji             | Tylko na stronie szczegółów                        | Czysty grid bez clutteru; edycja/usuwanie to akcje „szczegółowe”, nie przeglądowe       | Plan    |
| Migracja                    | Nowy plik `20260728000000_watches_soft_delete.sql` | Nie modyfikujemy wdrożonej migracji F-01; czysta historia                               | Plan    |

## Scope

**In scope:** kolumna `deleted_at` + indeks, zmiana FK na NO ACTION, regeneracja `database.types.ts`, `updateWatch` / `deleteWatch` w warstwie danych, filtry `deleted_at IS NULL` we wszystkich zapytaniach, `PUT` i `DELETE` w `/api/watches/[id]`, `EditWatchDialog`, dialog potwierdzenia usunięcia, przyciski akcji na stronie szczegółów.

**Out of scope:** widok archiwum / przywracanie usuniętych zegarków, hard/permanent delete, przyciski edycji/usuwania na kartach w gridzie, ekstrakcja wspólnej logiki `AddWatchDialog`/`EditWatchDialog`, edycja/usuwanie sesji noszenia (S-04).

## Architecture / Approach

Bottom-up: migracja → warstwa danych + API → UI. Nowa migracja dodaje `deleted_at` i zmienia FK. Wszystkie istniejące zapytania `watches` dostają `.is("deleted_at", null)`. `PUT /api/watches/[id]` przyjmuje częściowy update (name i/lub photoUrl). `DELETE` robi `UPDATE SET deleted_at = NOW()` — nigdy nie wydaje SQL `DELETE`. `EditWatchDialog` kopiuje strukturę `AddWatchDialog` (shadcn Dialog, upload do Storage, walidacja), ale używa PUT i czyści stary plik po udanym submicie.

## Phases at a Glance

| Faza                                                      | Co dostarcza                                                             | Kluczowe ryzyko                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 1. Soft-Delete Migration                                  | Kolumna `deleted_at`, zmiana FK, zregenerowane typy                      | Regeneracja typów nadpisze ręczne zmiany w `database.types.ts` (obecnie brak — plik jest generowany) |
| 2. Data Layer & API Routes                                | `updateWatch`, `deleteWatch`, filtry `deleted_at`, `PUT` + `DELETE`      | Pominięcie filtra w którymś zapytaniu → wyciek usuniętych zegarków                                   |
| 3. Edit Dialog, Delete Confirmation & Detail Page Actions | `EditWatchDialog`, dialog potwierdzenia, przyciski na stronie szczegółów | Logika czyszczenia starego zdjęcia przy edycji — best-effort, nie może zablokować update'u           |

**Prerequisites:** S-02 (`watch-collection-view`) wdrożony; lokalne Supabase z zastosowanymi migracjami F-01 i storage.
**Estimated effort:** ~2 sesje (1 faza na sesję, faza 2+3 razem).

## Open Risks & Assumptions

- **Regeneracja `database.types.ts`** zakłada, że plik nie był ręcznie modyfikowany poza generatorem — obecnie nie był, więc ryzyko zerowe.
- **Best-effort photo cleanup** — jeśli usunięcie starego pliku z bucketa się nie powiedzie, plik zostaje osierocony. Przy skali MVP to akceptowalne; nie budujemy kolejki cleanup.
- **Brak testów automatycznych** — weryfikacja opiera się na `npm run build`, `npm run lint` i testach manualnych. Projekt nie ma skonfigurowanego frameworka testowego.

## Success Criteria (Summary)

- Użytkownik edytuje nazwę i/lub zdjęcie zegarka przez modal — zmiany widoczne natychmiast na stronie szczegółów
- Użytkownik usuwa zegarek przez dialog potwierdzenia — znika z kolekcji, sesje noszenia zachowane
- Wszystkie zapytania `watches` filtrują po `deleted_at IS NULL` — usunięte zegarki nie wyciekają do UI
