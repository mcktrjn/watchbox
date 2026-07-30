# Wear Session Tracking — Implementation Plan

## Overview

Implement full CRUD for wear sessions — register, edit, and delete wearing sessions for a watch — surfaced as a chronological timeline list on the watch detail page (`/collection/[id]`). This is S-04 in the roadmap, the last prerequisite before S-05 (statistics — the North Star).

## Current State Analysis

- **`wear_sessions` table** exists with full RLS (select/insert/update/delete per-user), a `CHECK (ended_at > started_at)` constraint, moddatetime trigger, and indexes on `user_id`, `watch_id`, and `started_at`. The insert/update policies also verify that the referenced `watch_id` belongs to the same `user_id`.
- **`database.types.ts`** already has `wear_sessions` Row/Insert/Update types generated from the live schema.
- **Watches CRUD** (`src/lib/watches.ts` + `src/pages/api/watches/`) provides a clear pattern: typed lib functions → Astro API routes → React components with shadcn/ui dialogs.
- **`WatchDetailClient.tsx`** (`src/components/collection/WatchDetailClient.tsx`) currently renders the watch card + edit/delete buttons. It's a client-side React island (`client:load`) — the natural place to add the session list.
- **`collection/[id].astro`** fetches the watch server-side and passes it as props to `WatchDetailClient`. Sessions will be fetched client-side after mount.
- **No `src/lib/wear-sessions.ts` exists yet** — the data layer for sessions needs to be created from scratch.
- **No session API routes exist** — needs new nested routes under `src/pages/api/watches/[id]/sessions/`.

### Key Discoveries

- `wear_sessions` insert/update RLS policies already cross-check `watch_id` ownership via `EXISTS (SELECT 1 FROM watches WHERE watches.id = watch_id AND watches.user_id = auth.uid())` — the database enforces that users can only create sessions for their own watches.
- The `CHECK (ended_at > started_at)` constraint is already in the schema — server-side time-order validation is free.
- `WatchDetailClient` uses `useState` for watch data and dialog open/close state — the session list will extend this pattern with additional state for sessions, editing, and the add dialog.
- The existing `AddWatchDialog` and `EditWatchDialog` use `createBrowserSupabaseClient()` for photo uploads but call `fetch()` for the actual CRUD — sessions will follow the same pattern (no direct Supabase calls from the client for data mutations).

## Desired End State

A logged-in user opens a watch detail page and sees, below the watch card, a chronological list of all wear sessions for that watch. Each session row shows the date, time range (start–end), and a computed duration badge. The user can:

- **Add** a session via a dialog: pick a date (past or today), enter start and end times as HH:MM.
- **Edit** a session inline: the row transforms into editable date + time fields with save/cancel.
- **Delete** a session with a confirmation step.
- See an **empty state** with a CTA when no sessions exist yet.
- See a **soft warning** if a new/edited session overlaps an existing one (non-blocking).

All times are stored as UTC `TIMESTAMPTZ` and displayed in the user's local timezone.

## What We're NOT Doing

- **Statistics / charts** — that's S-05, a separate change.
- **Bulk operations** (delete all sessions, merge sessions) — out of scope.
- **Session notes or tags** — the schema only has `started_at`/`ended_at`; no extra metadata in MVP.
- **Pagination** — the session list loads all sessions for a watch. For MVP-scale collections this is fine; pagination can be added later if needed.
- **Multi-watch session view** — sessions are only viewed per-watch on the detail page.

## Implementation Approach

Follow the established watches CRUD pattern: **lib → API → UI**. The data layer (`src/lib/wear-sessions.ts`) provides typed functions. API routes under `src/pages/api/watches/[id]/sessions/` handle auth, validation, and delegate to the lib. React components in `src/components/collection/` render the UI and call the API via `fetch()`.

Sessions are fetched client-side after the watch detail page mounts — the Astro page only server-renders the watch data (existing behavior). This keeps the page fast and avoids blocking on session data.

## Critical Implementation Details

- **Date + time assembly**: The API receives `date` (ISO date string), `startTime`, and `endTime` (HH:MM strings). It assembles full ISO 8601 timestamps by combining the date with each time. The server must validate that the resulting `ended_at > started_at` before inserting, even though the DB CHECK constraint also catches it — this gives a better error message.
- **Future-date rejection**: The API must reject dates after today (server-side). Client-side validation is a convenience, not a security boundary.
- **Overlap detection**: After the user fills in the add/edit form, the client compares the candidate time range against already-loaded sessions. If an overlap is found, show a non-blocking warning below the form. The user can still submit.

## Phase 1: Data Layer

### Overview

Create `src/lib/wear-sessions.ts` with typed CRUD functions for the `wear_sessions` table, following the same patterns as `src/lib/watches.ts`.

### Changes Required

#### 1. Wear sessions lib module

**File**: `src/lib/wear-sessions.ts` (new)

**Intent**: Provide typed CRUD functions for wear sessions — list by watch, get by id, create, update, delete. All functions accept `SupabaseClient<Database>` and `userId` and enforce ownership via query filters.

**Contract**:

- `WearSession` type alias: `Tables<"wear_sessions">`
- `listSessions(supabase, userId, watchId): Promise<WearSession[]>` — ordered by `started_at DESC`
- `getSessionById(supabase, userId, sessionId): Promise<WearSession | null>`
- `createSession(supabase, userId, watchId, input: { startedAt: string; endedAt: string }): Promise<WearSession>`
- `updateSession(supabase, userId, sessionId, input: { startedAt?: string; endedAt?: string }): Promise<WearSession>`
- `deleteSession(supabase, userId, sessionId): Promise<{ id: string }>`

All functions filter by `user_id` for ownership. `createSession` sets `user_id` and `watch_id` explicitly. `updateSession` and `deleteSession` filter by `user_id` + `id`.

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification

- Import `listSessions` in a test context and verify it returns the correct shape from the live Supabase instance.

---

## Phase 2: API Routes

### Overview

Create nested API routes under `src/pages/api/watches/[id]/sessions/` for session CRUD, following the validation and error-handling patterns from `src/pages/api/watches/`.

### Changes Required

#### 1. Sessions list + create endpoint

**File**: `src/pages/api/watches/[id]/sessions/index.ts` (new)

**Intent**: `GET` returns all sessions for a watch (ordered by `started_at DESC`). `POST` creates a new session after validating the input.

**Contract**:

- `GET` — auth guard → validate `id` param → `listSessions(supabase, user.id, id)` → 200 JSON array
- `POST` — auth guard → parse JSON body → validate `date` (ISO date string, ≤ today), `startTime` (HH:MM), `endTime` (HH:MM) → assemble `startedAt`/`endedAt` ISO timestamps → validate `endedAt > startedAt` → `createSession(...)` → 201 JSON

Validation errors return 400 with `{ error: "..." }`. The `date` field must be today or earlier (server-enforced).

#### 2. Single session update + delete endpoint

**File**: `src/pages/api/watches/[id]/sessions/[sessionId].ts` (new)

**Intent**: `PUT` updates a session's times. `DELETE` removes a session. Both verify the session belongs to the user.

**Contract**:

- `PUT` — auth guard → validate `sessionId` → parse body → validate optional `date`/`startTime`/`endTime` → assemble timestamps → validate `endedAt > startedAt` if both provided → `updateSession(...)` → 200 JSON
- `DELETE` — auth guard → validate `sessionId` → `deleteSession(...)` → 200 `{ success: true }`

Both return 404 if the session doesn't exist or doesn't belong to the user.

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification

- `curl POST /api/watches/{id}/sessions` with valid body → 201 + session JSON
- `curl POST` with future date → 400 error
- `curl POST` with `endTime` before `startTime` → 400 error
- `curl GET /api/watches/{id}/sessions` → 200 + array
- `curl PUT /api/watches/{id}/sessions/{sessionId}` → 200 + updated session
- `curl DELETE /api/watches/{id}/sessions/{sessionId}` → 200

---

## Phase 3: UI Components

### Overview

Build React components for the session timeline list, add dialog, inline edit, delete confirmation, and empty state. All use shadcn/ui primitives and follow the visual patterns established by `AddWatchDialog` and `EditWatchDialog`.

### Changes Required

#### 1. Add session dialog

**File**: `src/components/collection/AddSessionDialog.tsx` (new)

**Intent**: A modal dialog with date picker + start time + end time inputs. Validates client-side (date ≤ today, end > start), checks for overlaps against already-loaded sessions, and calls `POST /api/watches/{watchId}/sessions` on submit.

**Contract**:

- Props: `{ watchId: string; open: boolean; onOpenChange: (open: boolean) => void; onCreated: (session: WearSession) => void; existingSessions: WearSession[] }`
- Form fields: `<input type="date">` (max=today), `<input type="time">` for start, `<input type="time">` for end
- Overlap warning: compare candidate range against `existingSessions`; if overlap detected, show a non-blocking warning message below the form
- Submit: `POST /api/watches/{watchId}/sessions` with `{ date, startTime, endTime }`
- Loading state on submit button (spinner + "Adding...")
- Error display via `ServerError` component
- Reset form on close

#### 2. Session list with inline edit

**File**: `src/components/collection/WearSessionList.tsx` (new)

**Intent**: Renders the chronological list of sessions. Each row shows date, time range, duration badge, and edit/delete buttons. Clicking edit transforms the row into editable fields.

**Contract**:

- Props: `{ watchId: string; sessions: WearSession[]; onSessionsChange: (sessions: WearSession[]) => void }`
- Each row in view mode: formatted date, "HH:MM – HH:MM", duration badge (e.g. "8h 30m"), edit + delete icon buttons
- Edit mode (one row at a time, tracked by `editingId` state): date input + start time input + end time input + save/cancel buttons
- Save calls `PUT /api/watches/{watchId}/sessions/{sessionId}`, updates the local list on success
- Delete shows a confirmation state inline (or a small confirm dialog), then calls `DELETE`
- Duration computed client-side: `(ended_at - started_at)` in hours/minutes
- Times displayed in local timezone via `toLocaleTimeString`

#### 3. Empty state

**File**: `src/components/collection/EmptySessionState.tsx` (new)

**Intent**: Shown when a watch has no sessions. Displays a message explaining the feature and a CTA button to open the add dialog.

**Contract**:

- Props: `{ onAddClick: () => void }`
- Message: "No wear sessions yet. Track how often you wear this watch."
- Prominent "Log Session" button

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification

- Open a watch detail page → empty state renders with CTA
- Click "Log Session" → dialog opens with date/time fields
- Fill in valid data → session appears in the list with correct date, time range, and duration
- Click edit on a session → row transforms to editable fields
- Change times and save → row updates with new values
- Click delete → confirmation → session removed from list
- Create overlapping session → warning appears but submission succeeds
- Try future date → client-side validation blocks it

---

## Phase 4: Integration

### Overview

Wire the session components into `WatchDetailClient` and update `collection/[id].astro` if needed.

### Changes Required

#### 1. WatchDetailClient — add sessions section

**File**: `src/components/collection/WatchDetailClient.tsx` (edit)

**Intent**: Add a sessions section below the watch card. Fetch sessions on mount, render the list or empty state, and wire the add dialog.

**Contract**:

- Add state: `sessions: WearSession[]`, `sessionsLoading: boolean`, `addSessionOpen: boolean`
- `useEffect` on mount: `fetch(\`/api/watches/${watch.id}/sessions\`)` → populate sessions
- Below the existing watch card `<div>`, render:
  - Section heading "Wear History"
  - If loading: subtle spinner
  - If empty: `<EmptySessionState onAddClick={...} />`
  - If sessions exist: `<WearSessionList ...>` + "Log Session" button above the list
- `<AddSessionDialog>` wired to `addSessionOpen` state
- `handleSessionCreated`: prepend new session to list
- `handleSessionsChange`: replace entire list (for edit/delete updates)

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npx astro check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification

- Full flow: navigate to a watch detail → see empty state → add session → see it in list → edit it → delete it
- Refresh the page → sessions persist
- Navigate to a different watch → only that watch's sessions appear
- Log out and log in as a different user → cannot see another user's sessions

---

## Testing Strategy

### Manual Testing Steps

1. Add a session with valid date/times → appears in list with correct duration
2. Add a session with end time before start time → client validation blocks it
3. Add a session with a future date → client validation blocks it
4. Add a session that overlaps an existing one → warning shown, submission still works
5. Edit a session's times → row updates, duration recalculates
6. Delete a session → removed from list
7. Verify RLS: sessions from one user are not visible to another user
8. Verify the empty state renders correctly for a watch with no sessions

---

## References

- PRD: `context/foundation/prd.md` — FR-009, FR-010, US-01
- Roadmap: `context/foundation/roadmap.md` — S-04
- Schema migration: `supabase/migrations/20260630000000_watches_and_wear_sessions.sql`
- Database types: `src/lib/database.types.ts`
- Pattern reference — watches lib: `src/lib/watches.ts`
- Pattern reference — watches API: `src/pages/api/watches/index.ts`, `src/pages/api/watches/[id].ts`
- Pattern reference — dialog UI: `src/components/collection/AddWatchDialog.tsx`, `src/components/collection/EditWatchDialog.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Data Layer

#### Automated

- [x] 1.1 TypeScript compilation passes: `npx astro check`
- [x] 1.2 Linting passes: `npm run lint`

#### Manual

- [ ] 1.3 Import `listSessions` and verify correct shape from live Supabase

### Phase 2: API Routes

#### Automated

- [ ] 2.1 TypeScript compilation passes: `npx astro check`
- [ ] 2.2 Linting passes: `npm run lint`

#### Manual

- [ ] 2.3 POST valid session → 201 + session JSON
- [ ] 2.4 POST future date → 400 error
- [ ] 2.5 POST endTime before startTime → 400 error
- [ ] 2.6 GET sessions → 200 + array
- [ ] 2.7 PUT session → 200 + updated session
- [ ] 2.8 DELETE session → 200

### Phase 3: UI Components

#### Automated

- [ ] 3.1 TypeScript compilation passes: `npx astro check`
- [ ] 3.2 Linting passes: `npm run lint`

#### Manual

- [ ] 3.3 Empty state renders with CTA
- [ ] 3.4 Add dialog opens with date/time fields
- [ ] 3.5 Valid submission → session appears in list
- [ ] 3.6 Inline edit → row transforms, save updates row
- [ ] 3.7 Delete → confirmation → session removed
- [ ] 3.8 Overlap warning appears but submission succeeds
- [ ] 3.9 Future date blocked client-side

### Phase 4: Integration

#### Automated

- [ ] 4.1 TypeScript compilation passes: `npx astro check`
- [ ] 4.2 Linting passes: `npm run lint`
- [ ] 4.3 Build succeeds: `npm run build`

#### Manual

- [ ] 4.4 Full flow: empty → add → edit → delete on watch detail page
- [ ] 4.5 Sessions persist across page refresh
- [ ] 4.6 Sessions are scoped to the correct watch
- [ ] 4.7 RLS: sessions isolated per user
