# Watch Collection Manage — Implementation Plan

## Overview

Add edit (name + photo) and delete (soft delete via `deleted_at`) capabilities to the watch collection. Actions are available from the detail page `/collection/[id]`. A new migration introduces the `deleted_at` column and relaxes the foreign key on `wear_sessions` so that soft-deleting a watch preserves its wear history. All existing `watches` queries gain a `deleted_at IS NULL` filter.

## Current State Analysis

- S-02 (`watch-collection-view`) delivered the list grid (`/collection`), detail page (`/collection/[id]`), and add-watch dialog. Watches are created with `name` + optional `photo_url`.
- `src/lib/watches.ts` exports `listWatches`, `getWatchById`, `createWatch` — no update or delete helpers.
- `src/pages/api/watches/[id].ts` handles only `GET` — no `PUT`/`PATCH`/`DELETE`.
- `src/pages/collection/[id].astro` is a read-only detail view: photo/placeholder, name, and "Added on" date. No action buttons.
- `WatchCard.tsx` is a plain `<a>` link — no edit/delete affordances.
- The F-01 migration (`20260630000000_watches_and_wear_sessions.sql`) has `wear_sessions.watch_id REFERENCES watches(id) ON DELETE CASCADE`. This must change to `ON DELETE NO ACTION` so soft-delete doesn't cascade.
- `database.types.ts` has no `deleted_at` column on `watches` — must be regenerated after migration.
- OQ-1 resolved (2026-07-28): soft delete via `deleted_at` column. Wear sessions are preserved. Statistics (S-05) will filter `WHERE deleted_at IS NULL`.

### Key Discoveries

- `AddWatchDialog.tsx` handles photo upload via direct-to-Storage browser client (`createBrowserSupabaseClient`), then POSTs to `/api/watches` with the resulting `photoUrl`. The edit dialog must mirror this pattern but with a PUT and old-file cleanup — [src/components/collection/AddWatchDialog.tsx:113-145](../../../src/components/collection/AddWatchDialog.tsx#L113-L145).
- The `watch-photos` bucket RLS policies scope writes to `(storage.foldername(name))[1] = auth.uid()::text` — the edit dialog's old-file removal must target the same user-id-prefixed path — [supabase/migrations/20260720000000_watch_photos_storage.sql:17-30](../../../supabase/migrations/20260720000000_watch_photos_storage.sql#L17-L30).
- `src/middleware.ts` protects `/collection` but not `/api/watches*` — API routes must independently check `context.locals.user` (already done for GET; PUT/DELETE must follow the same pattern) — [src/middleware.ts:4](../../../src/middleware.ts#L4).
- The existing `toErrorMessage` helper in `[id].ts` is duplicated from `index.ts` — this plan does not extract it (out of scope), but the new PUT/DELETE handlers reuse the same local pattern.

## Desired End State

A signed-in user can:

1. Open `/collection/[id]`, click "Edit", change the name and/or photo in a modal, and see the updated details immediately.
2. Click "Delete", confirm in a dialog, and be redirected to `/collection` — the watch disappears from the grid but its wear sessions remain intact in the database.
3. All existing list/detail queries automatically exclude soft-deleted watches (`WHERE deleted_at IS NULL`).

Verification: `npm run build` and `npm run lint` pass; manual test: edit name + photo, delete with confirmation, verify deleted watch is gone from list but `SELECT * FROM watches WHERE deleted_at IS NOT NULL` returns the row.

## What We're NOT Doing

- An "archive" view to restore soft-deleted watches (future scope — PRD non-goal for MVP).
- Hard/permanent delete of watches or their wear sessions.
- Editing or deleting wear sessions (S-04).
- Adding edit/delete buttons to `WatchCard` in the grid — actions live only on the detail page.
- Extracting shared form logic between `AddWatchDialog` and `EditWatchDialog` — they remain separate components.
- Changing the photo Storage bucket policies or upload path convention.

## Implementation Approach

Bottom-up: migration first (schema change is the foundation), then data layer + API (all queries adapt to `deleted_at`), then UI (edit dialog, delete confirmation, detail page buttons). The edit dialog follows the `AddWatchDialog` pattern closely — direct-to-Storage upload, then API call — but as a separate component with its own props and submit logic.

## Critical Implementation Details

**`deleted_at` filter must be applied to every existing `watches` query.** `listWatches`, `getWatchById`, and the `wear_sessions_insert`/`wear_sessions_update` RLS policies' `EXISTS` subquery all touch `watches` without a `deleted_at` check. Missing one means soft-deleted watches leak back into the UI or block wear-session operations on deleted watches. The RLS policies in the existing migration are NOT updated by this plan — they reference `watches` for ownership checks, not for visibility, and a soft-deleted watch's `user_id` is still correct. The application-layer queries (`listWatches`, `getWatchById`) are the visibility boundary.

**FK constraint change is one-way.** Changing `ON DELETE CASCADE` to `ON DELETE NO ACTION` means `DELETE FROM watches WHERE id = …` will fail if wear sessions exist — but this plan never issues a hard `DELETE` against `watches` (only `UPDATE SET deleted_at = NOW()`), so the constraint change is purely defensive. The old CASCADE behavior is removed to prevent accidental hard-deletes from cascading.

**Photo cleanup on edit is best-effort.** When the user changes a photo, the edit flow: (1) uploads the new file, (2) calls PUT `/api/watches/[id]` with the new `photoUrl`, (3) on success, removes the old file from Storage. If step 3 fails, the old file is orphaned but the watch data is correct — acceptable for MVP scale.

---

## Phase 1: Soft-Delete Migration

### Overview

Add `deleted_at` column to `watches`, change the `wear_sessions.watch_id` FK from `ON DELETE CASCADE` to `ON DELETE NO ACTION`, and regenerate `database.types.ts` to include the new column.

### Changes Required:

#### 1. New migration file

**File**: `supabase/migrations/20260728000000_watches_soft_delete.sql` (new)

**Intent**: Introduce soft-delete support without modifying the already-deployed F-01 migration. The `deleted_at` column is nullable `TIMESTAMPTZ` — `NULL` means active, non-`NULL` means deleted. The FK change prevents accidental hard-deletes from cascading into `wear_sessions`.

**Contract**: `ALTER TABLE watches ADD COLUMN deleted_at TIMESTAMPTZ;` followed by `ALTER TABLE wear_sessions DROP CONSTRAINT wear_sessions_watch_id_fkey;` and `ALTER TABLE wear_sessions ADD CONSTRAINT wear_sessions_watch_id_fkey FOREIGN KEY (watch_id) REFERENCES watches(id) ON DELETE NO ACTION;`. Add an index `CREATE INDEX idx_watches_deleted_at ON watches(deleted_at);` for efficient filtering.

#### 2. Regenerated database types

**File**: `src/lib/database.types.ts`

**Intent**: Reflect the new `deleted_at` column in the `watches` Row/Insert/Update types so all queries are type-checked against the current schema.

**Contract**: Regenerate via `npx supabase gen types typescript --local > src/lib/database.types.ts`. The `watches.Row` type must include `deleted_at: string | null`; `watches.Insert` must include `deleted_at?: string | null`; `watches.Update` must include `deleted_at?: string | null`.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` applies all migrations cleanly (F-01, storage, soft-delete)
- `psql` query confirms `deleted_at` column exists on `watches` with type `TIMESTAMPTZ`
- `psql` query confirms `wear_sessions_watch_id_fkey` has `confdeltype = 'n'` (NO ACTION) in `pg_constraint`
- `npm run build` completes without type errors
- `npm run lint` passes

#### Manual Verification:

- Supabase Studio → Table Editor → `watches` → confirm `deleted_at` column is visible, nullable, no default value
- Studio → Database → Foreign Keys → confirm `wear_sessions.watch_id → watches.id` shows `ON DELETE NO ACTION`

---

## Phase 2: Data Layer & API Routes

### Overview

Add `updateWatch` and `deleteWatch` helpers to `src/lib/watches.ts`, add `deleted_at IS NULL` filters to all existing `watches` queries, and implement `PUT` and `DELETE` handlers in `/api/watches/[id]`.

### Changes Required:

#### 1. Update and delete helpers

**File**: `src/lib/watches.ts`

**Intent**: Provide typed, RLS-scoped helpers for updating a watch's name/photo and soft-deleting a watch. The existing `listWatches` and `getWatchById` gain a `deleted_at IS NULL` filter.

**Contract**:

- `listWatches`: add `.is("deleted_at", null)` to the query chain.
- `getWatchById`: add `.is("deleted_at", null)` to the query chain.
- `updateWatch(supabase, userId, id, input: { name?: string; photoUrl?: string | null })`: calls `.update({ name: input.name, photo_url: input.photoUrl }).eq("user_id", userId).eq("id", id).select("*").single()`. Returns `Watch`. Only updates fields present in `input` (partial update — Supabase `.update()` handles this natively when fields are `undefined`).
- `deleteWatch(supabase, userId, id)`: calls `.update({ deleted_at: new Date().toISOString() }).eq("user_id", userId).eq("id", id).select("id").single()`. Returns `{ id: string }` on success. This is a soft delete — an UPDATE, not a DELETE.

#### 2. PUT and DELETE API handlers

**File**: `src/pages/api/watches/[id].ts`

**Intent**: Add `PUT` (update name/photo) and `DELETE` (soft delete) handlers alongside the existing `GET`. Follow the same auth-check + null-check-supabase + try/catch pattern already established.

**Contract**:

- `PUT`: parse JSON body, validate `name` (optional, but if present must be non-empty string ≤ 100 chars) and `photoUrl` (optional, string or null). Call `updateWatch(supabase, user.id, id, { name, photoUrl })`. Return 200 with the updated watch. Return 404 if watch not found. Return 400 for invalid input.
- `DELETE`: call `deleteWatch(supabase, user.id, id)`. Return 200 with `{ success: true }`. Return 404 if watch not found (already deleted or doesn't exist).

### Success Criteria:

#### Automated Verification:

- `npm run build` completes without type errors
- `npm run lint` passes

#### Manual Verification:

- `GET /api/watches` — soft-deleted watches do not appear in the list
- `GET /api/watches/[id]` — returns 404 for a soft-deleted watch
- `PUT /api/watches/[id]` — updates name only, photoUrl only, or both; returns updated watch
- `PUT /api/watches/[id]` — returns 400 for empty name
- `DELETE /api/watches/[id]` — sets `deleted_at`, returns `{ success: true }`
- `DELETE /api/watches/[id]` — returns 404 when called again on the same watch
- All endpoints return 401 when unauthenticated

---

## Phase 3: Edit Dialog, Delete Confirmation & Detail Page Actions

### Overview

Build the `EditWatchDialog` component (modal with name + photo fields, mirroring `AddWatchDialog`), a delete confirmation dialog, and wire both into the detail page `/collection/[id]` with action buttons.

### Changes Required:

#### 1. EditWatchDialog component

**File**: `src/components/collection/EditWatchDialog.tsx` (new)

**Intent**: Let the user change a watch's name and/or photo. Mirrors `AddWatchDialog` in structure (shadcn Dialog, client-side validation, direct-to-Storage upload, API call) but pre-fills with existing values and uses PUT instead of POST.

**Contract**: Props `{ watch: { id: string; name: string; photoUrl: string | null }; open: boolean; onOpenChange: (open: boolean) => void; onUpdated: (watch: Watch) => void }`. On submit: (1) if a new file is selected, upload to Storage (same path convention as AddWatchDialog), (2) PUT to `/api/watches/[id]` with updated name and/or new photoUrl, (3) on success, if there was an old photo and a new one was uploaded, remove the old file from Storage (best-effort — failure is logged but not surfaced to the user), (4) call `onUpdated` with the response, close dialog, reset form. Validation: name required, ≤ 100 chars; file type/size same as AddWatchDialog (JPEG/PNG/WebP, ≤ 5MB).

#### 2. Delete confirmation dialog

**File**: `src/components/collection/EditWatchDialog.tsx` (inline in the same file, or a small inline component in the detail page)

**Intent**: Prevent accidental deletion. Show a confirmation prompt explaining that wear sessions will be preserved.

**Contract**: A shadcn `Dialog` with title "Delete watch?", body text "This watch will be removed from your collection. Its wear history will be preserved." and two buttons: "Cancel" (secondary) and "Delete" (destructive variant). On confirm: call `DELETE /api/watches/[id]`, then redirect to `/collection`.

**Implementation note**: The delete confirmation can be a lightweight inline dialog within `[id].astro`'s client island rather than a separate exported component — it has no reusable props beyond the watch id.

#### 3. Detail page action buttons

**File**: `src/pages/collection/[id].astro`

**Intent**: Add "Edit" and "Delete" buttons to the watch detail page, wired to the edit dialog and delete confirmation.

**Contract**: Below the "Added on" date, add a `<div>` with two shadcn `Button` components: "Edit" (secondary/outline variant) and "Delete" (destructive variant). These must be inside a client island (`client:load`) since they trigger dialogs. The island manages `editOpen` / `deleteOpen` state and the `onUpdated` callback refreshes the displayed name/photo without a full page reload.

### Success Criteria:

#### Automated Verification:

- `npm run build` completes without type errors
- `npm run lint` passes

#### Manual Verification:

- Edit dialog opens pre-filled with current name; changing name and submitting updates the detail page
- Edit dialog: selecting a new photo replaces the old one; old file is removed from Storage (verify via Supabase Studio)
- Edit dialog: clearing the photo (no file selected) keeps the existing photo (photoUrl unchanged)
- Edit dialog: validation errors (empty name, wrong file type) show inline and block submit
- Delete confirmation: clicking "Delete" opens the dialog; "Cancel" closes it; "Delete" soft-deletes and redirects to `/collection`
- After delete, the watch no longer appears in the collection grid
- After delete, `GET /api/watches/[id]` returns 404
- Both dialogs close on Escape and click-outside (standard shadcn Dialog behavior)

---

## Testing Strategy

### Unit Tests

No test framework is configured project-wide (per `AGENTS.md`). Verification relies on lint, build, and manual testing.

### Manual Testing Steps

1. Add a watch with a photo, then edit its name — confirm the detail page updates.
2. Edit the photo — confirm the old file is gone from Storage and the new one displays.
3. Edit a watch that has no photo — add one, confirm it appears.
4. Delete a watch with wear sessions (pre-create via SQL) — confirm soft delete succeeds, sessions remain.
5. Delete a watch, then try to access its detail page directly — confirm 404.
6. Verify the collection list no longer shows the deleted watch.
7. Spot-check RLS: log in as a different user and try `PUT /api/watches/[id]` for another user's watch — confirm 404 (not 401, to avoid leaking existence).

## Performance Considerations

- The `deleted_at IS NULL` filter benefits from the new index `idx_watches_deleted_at` (Phase 1). For typical collection sizes (tens of watches), the index is not load-bearing but is good practice.
- Photo upload during edit follows the same 5MB/type limits as add — no new performance concerns.

## Migration Notes

- The new migration (`20260728000000_watches_soft_delete.sql`) is additive — it does not modify existing rows. All existing watches will have `deleted_at = NULL` (active).
- The FK constraint change from `CASCADE` to `NO ACTION` is backward-compatible because no code path issues a hard `DELETE` against `watches`.
- `database.types.ts` regeneration must happen after the migration is applied locally (`npx supabase db reset` or `npx supabase db push`).

## References

- Related plan (S-02): `context/archive/2026-07-20-watch-collection-view/plan.md`
- F-01 migration: `supabase/migrations/20260630000000_watches_and_wear_sessions.sql`
- Storage migration: `supabase/migrations/20260720000000_watch_photos_storage.sql`
- Roadmap: `context/foundation/roadmap.md` (S-03, OQ-1 resolved)
- PRD: `context/foundation/prd.md` (FR-007, FR-008)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Soft-Delete Migration

#### Automated

- [x] 1.1 `npx supabase db reset` applies all migrations cleanly
- [x] 1.2 `deleted_at` column exists on `watches` with type `TIMESTAMPTZ`
- [x] 1.3 `wear_sessions_watch_id_fkey` has `ON DELETE NO ACTION`
- [x] 1.4 `npm run build` completes without type errors
- [x] 1.5 `npm run lint` passes

#### Manual

- [x] 1.6 Supabase Studio confirms `deleted_at` column and FK constraint

### Phase 2: Data Layer & API Routes

#### Automated

- [ ] 2.1 `npm run build` completes without type errors
- [ ] 2.2 `npm run lint` passes

#### Manual

- [ ] 2.3 GET /api/watches excludes soft-deleted watches
- [ ] 2.4 GET /api/watches/[id] returns 404 for soft-deleted watch
- [ ] 2.5 PUT /api/watches/[id] updates name and/or photo correctly
- [ ] 2.6 PUT /api/watches/[id] returns 400 for empty name
- [ ] 2.7 DELETE /api/watches/[id] soft-deletes and returns success
- [ ] 2.8 DELETE /api/watches/[id] returns 404 on second call
- [ ] 2.9 All endpoints return 401 when unauthenticated

### Phase 3: Edit Dialog, Delete Confirmation & Detail Page Actions

#### Automated

- [ ] 3.1 `npm run build` completes without type errors
- [ ] 3.2 `npm run lint` passes

#### Manual

- [ ] 3.3 Edit dialog pre-fills with current name; submit updates detail page
- [ ] 3.4 Edit dialog: new photo replaces old; old file removed from Storage
- [ ] 3.5 Edit dialog: validation errors block submit
- [ ] 3.6 Delete confirmation: Cancel closes, Delete soft-deletes and redirects
- [ ] 3.7 Deleted watch no longer appears in collection grid
- [ ] 3.8 RLS: another user cannot access or modify the watch
