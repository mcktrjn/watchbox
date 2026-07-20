# Watch Collection View Implementation Plan

## Overview

Implement the first user-facing slice of the watch collection (roadmap S-02): a signed-in user can add a watch (name required, photo optional) to their collection, browse the collection as a photo-forward grid, and open a minimal detail view for a single watch. This plan also lays the storage and typed-client foundations (Supabase Storage bucket, `Database` generic wiring, browser Supabase client) that S-03/S-04 will build on.

## Current State Analysis

- `watches` table exists with RLS (`user_id = auth.uid()`) since F-01 — [supabase/migrations/20260630000000_watches_and_wear_sessions.sql](../../../supabase/migrations/20260630000000_watches_and_wear_sessions.sql). No rows can be queried yet — no application code touches this table.
- `src/lib/database.types.ts` is generated but not wired in: `createClient()` in [src/lib/supabase.ts](../../../src/lib/supabase.ts) calls `createServerClient(...)` without the `Database` generic, so all Supabase queries are currently untyped.
- No Supabase Storage bucket exists. `supabase/config.toml` has Storage enabled globally but no bucket configured — the archived `database-schema` plan explicitly deferred this to S-02.
- `SUPABASE_URL` / `SUPABASE_KEY` are declared **server-only secret** in `astro.config.mjs` (`envField.string({ context: "server", access: "secret" })`) and are the Supabase **anon** key (confirmed via README §Supabase Configuration) — safe to also expose for client-side use, but require a _separate_, explicitly public env declaration to stay compliant with the repo's hard rule of never reaching for `process.env`/`import.meta.env` directly.
- No browser-side Supabase client exists — only the cookie-based SSR client in `src/lib/supabase.ts`.
- UI kit is minimal: only `src/components/ui/button.tsx` and `LibBadge.astro` exist under `src/components/ui/`; `card`, `dialog`, `input`, `label` are not yet added despite `components.json` being configured for shadcn (New York style, neutral base).
- `src/middleware.ts` only protects `/dashboard`; `PROTECTED_ROUTES` must gain the new route. Middleware does not cover `/api/*` — API routes must check `context.locals.user` themselves.
- Existing API convention ([src/pages/api/auth/signup.ts](../../../src/pages/api/auth/signup.ts)) is `formData` POST → redirect-with-query-error. This plan introduces the first JSON API convention for the app (needed for the modal add-flow and direct-to-storage upload); it is scoped to `/api/watches*` and does not touch the auth routes.
- `dashboard.astro` is currently a placeholder welcome screen with only a sign-out button.
- CI (`.github/workflows/ci.yml`) passes `SUPABASE_URL`/`SUPABASE_KEY` as build-time env for the `npm run build` step; the new client-context env vars need the same treatment since Astro inlines `astro:env/client` values at build time.

## Desired End State

A signed-in user can:

1. Navigate to `/collection` (linked from the dashboard) and see their watches as a card grid, or an empty state with a call-to-action if they have none.
2. Click "Add watch", fill in a name (required) and optionally pick a photo, and see the new watch appear in the grid without a full page reload.
3. Click a card to open `/collection/[id]` and see the watch's photo (or a placeholder), name, and the date it was added.

Verification: `npm run build` and `npm run lint` pass; manually adding a watch with and without a photo both succeed and RLS prevents one user from seeing another's watches (spot-checked via two local test accounts).

### Key Discoveries

- `SUPABASE_KEY` is the anon public key (README confirms), so reusing its value under a new `PUBLIC_`-prefixed, client-context env var is safe — RLS remains the real security boundary, not key secrecy.
- Astro's `astro:env/client` variables are inlined into the client bundle at **build time**, not read at request time — they must be present in `.env` for local dev/build and as CI env for the `npm run build` step in `.github/workflows/ci.yml`, distinct from the `.dev.vars` / `wrangler secret put` mechanism used for the server-only vars.
- `storage.objects` RLS policies use `(storage.foldername(name))[1]` to read the first path segment — the upload path convention (`{user_id}/{uuid}.{ext}`) must match this exactly for owner-only write policies to work.

## What We're NOT Doing

- Editing or deleting watches (S-03, `watch-collection-manage`).
- Wear session tracking or statistics (S-04, S-05).
- Any auto-fill of watch data/photos from an external knowledge base (PRD non-goal).
- Signed/expiring photo URLs — the bucket is public-read (object paths are per-user UUIDs, impractical to guess) with owner-only write via RLS; revisit only if a real leakage risk surfaces.
- Image resizing, cropping, or compression pipelines — accept files as-is up to a size/type limit enforced by both the bucket config and client-side validation.
- An automated test suite — none is configured project-wide (per `AGENTS.md`); verification relies on lint, build, and manual testing.
- Changing the existing auth API's form-POST convention — the new JSON API convention is scoped to `/api/watches*` only.

## Implementation Approach

Add a Supabase Storage bucket + typed clients first (server generic + new browser client), then build the UI bottom-up: shared primitives → data-access API → list page → add-watch dialog → detail page. The list page does an SSR fetch for the first paint (fast, no loading flash) and the add-dialog updates the same list client-side afterward (optimistic prepend + background re-fetch) — no full page reload for the primary "add" action.

## Critical Implementation Details

**Client env vars need build-time presence, not just runtime secrets.** `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` must be declared with `context: "client", access: "public"` in `astro.config.mjs`, added to `.env`/`.env.example` for local dev, and added to the `env:` block of the `npm run build` step in `.github/workflows/ci.yml` alongside the existing `SUPABASE_URL`/`SUPABASE_KEY` entries — otherwise the deployed client bundle silently ships with `undefined` values and the upload flow breaks only in production.

**Storage RLS path convention.** The `watch-photos` bucket policies restrict INSERT/UPDATE/DELETE to `(storage.foldername(name))[1] = auth.uid()::text`. The browser upload call must build the object path as `${user.id}/${crypto.randomUUID()}.${ext}` — any other path shape (e.g., missing the user-id prefix) will be silently rejected by RLS with a generic 403 from Storage.

**API routes are not covered by `PROTECTED_ROUTES` middleware.** `src/middleware.ts` only redirects page routes matching `PROTECTED_ROUTES`; `/api/watches*` must independently check `context.locals.user` and return a JSON 401 (not a redirect) when absent, as defense-in-depth alongside RLS.

---

## Phase 1: Storage & Client Foundations

### Overview

Create the `watch-photos` Storage bucket with owner-only write RLS, wire the `Database` generic into the existing server Supabase client, add a new browser Supabase client for direct-to-storage uploads, and expose the public env vars this requires.

### Changes Required:

#### 1. Storage bucket + RLS migration

**File**: `supabase/migrations/20260720000000_watch_photos_storage.sql`

**Intent**: Create a public-read, owner-write-only bucket for watch photos, matching the RLS pattern already used for `watches`/`wear_sessions`.

**Contract**: Insert one row into `storage.buckets` (`id`/`name` = `watch-photos`, `public = true`, `file_size_limit` = 5MB, `allowed_mime_types` = `image/jpeg`, `image/png`, `image/webp`). Add 3 RLS policies on `storage.objects` scoped to `bucket_id = 'watch-photos'`: INSERT, UPDATE, DELETE each require `(storage.foldername(name))[1] = auth.uid()::text`. No SELECT policy is needed — public buckets serve reads outside RLS.

#### 2. Typed server Supabase client

**File**: `src/lib/supabase.ts`

**Intent**: Make all server-side Supabase queries type-safe against the generated schema, so the new watches API/pages get compile-time checked row types.

**Contract**: Import `Database` from `@/lib/database.types` and change `createServerClient(...)` to `createServerClient<Database>(...)`. Return type becomes `SupabaseClient<Database> | null`; existing null-check call sites are unaffected.

#### 3. Browser Supabase client

**File**: `src/lib/supabase-browser.ts` (new)

**Intent**: Provide a typed, publishable-key Supabase client for the browser, used only for direct-to-storage photo uploads. Mirrors the existing null-check-when-unconfigured pattern from `src/lib/supabase.ts`.

**Contract**: Export `createBrowserSupabaseClient()` returning `createBrowserClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)` from `@supabase/ssr`, importing the two vars from `astro:env/client`. Return `null` when either var is empty, matching the server client's contract.

#### 4. Public env var declarations

**File**: `astro.config.mjs`

**Intent**: Expose the anon key/URL to the client bundle through Astro's env schema (not raw `import.meta.env`), keeping the existing server secrets untouched.

**Contract**: Add `PUBLIC_SUPABASE_URL: envField.string({ context: "client", access: "public", optional: true })` and `PUBLIC_SUPABASE_ANON_KEY: envField.string({ context: "client", access: "public", optional: true })` to the `env.schema` object, alongside the existing `SUPABASE_URL`/`SUPABASE_KEY` entries.

#### 5. Local env docs

**File**: `.env.example`, `README.md`

**Intent**: Keep local setup instructions accurate — a new contributor must know these two vars exist and where their values come from (same Supabase dashboard values as `SUPABASE_URL`/`SUPABASE_KEY`).

**Contract**: Add `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` entries to `.env.example` with the same example values pattern as `SUPABASE_URL`/`SUPABASE_KEY`. Add a short note under README §Supabase Configuration clarifying these are the same URL/anon-key values, re-declared for client use, and must live in `.env` (not `.dev.vars`) since they're inlined at build time.

#### 6. CI build env

**File**: `.github/workflows/ci.yml`

**Intent**: Ensure the deployed client bundle isn't built with undefined public env vars.

**Contract**: Add `PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}` and `PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_KEY }}` to the existing `env:` block of the `npm run build` step (reusing the same repository secrets — same values, different var names).

### Success Criteria:

#### Automated Verification:

- `npm run supabase:db:push` (or `supabase db reset`) applies the new migration cleanly
- `psql $LOCAL_DB_URL -c "SELECT * FROM storage.buckets WHERE id = 'watch-photos'"` returns one row with `public = true`
- `psql $LOCAL_DB_URL -c "SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%watch-photos%'"` — adjust policy names to be greppable and confirm 3 rows
- `npm run build` completes without type errors
- `npm run lint` passes

#### Manual Verification:

- Supabase Studio → Storage → confirm `watch-photos` bucket exists and is marked public
- Studio → Storage → Policies → confirm 3 policies scoped to the bucket

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Shared UI Primitives

### Overview

Add the shadcn primitives this feature needs and build the small presentational components shared by the list and detail pages.

### Changes Required:

#### 1. shadcn components

**File**: `src/components/ui/card.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/input.tsx`, `src/components/ui/label.tsx` (new, generated)

**Intent**: Add the standard shadcn New York-style primitives needed for the card grid and add-watch dialog, consistent with the already-configured `components.json`.

**Contract**: Generated via the shadcn CLI (`npx shadcn@latest add card dialog input label`) — no hand-written deviation from the generated output.

#### 2. `WatchCard` component

**File**: `src/components/collection/WatchCard.tsx` (new)

**Intent**: Render one watch as a clickable card: photo (or a placeholder watch icon from `lucide-react` when `photo_url` is null) and name, linking to `/collection/{id}`.

**Contract**: Props `{ id: string; name: string; photoUrl: string | null }`. Renders inside a shadcn `Card`, wrapped in an `<a href={`/collection/${id}`}>`. Follows the existing glass-morphism visual convention (e.g. `border-white/10 bg-white/5`, as used in `Topbar.astro`/`dashboard.astro`) rather than the default shadcn light theme, to stay visually consistent with the rest of the app.

#### 3. `EmptyCollectionState` component

**File**: `src/components/collection/EmptyCollectionState.tsx` (new)

**Intent**: Explain the empty state and offer a clear next action, per the PRD's aesthetics guardrail (no bare "no data" screen).

**Contract**: Props `{ onAddClick: () => void }`. Renders centered copy + a `Button` that triggers the add-watch dialog (wired in Phase 5).

### Success Criteria:

#### Automated Verification:

- `npm run build` completes without type errors
- `npm run lint` passes

#### Manual Verification:

- Rendering `WatchCard` with and without a `photoUrl` looks correct (placeholder icon vs. photo)
- `EmptyCollectionState` reads clearly and matches the app's existing visual style

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Watches Data Access & API Routes

### Overview

Add a small typed data-access module shared by SSR pages and API routes, then the JSON API routes for listing, creating, and fetching a single watch.

### Changes Required:

#### 1. Data access helpers

**File**: `src/lib/watches.ts` (new)

**Intent**: Centralize the RLS-scoped `watches` queries so the SSR list/detail pages and the API routes don't duplicate query logic.

**Contract**: Export `listWatches(supabase, userId)`, `getWatchById(supabase, userId, id)`, and `createWatch(supabase, userId, input: { name: string; photoUrl?: string | null })`, each typed against `Tables<'watches'>` from `database.types.ts`. All three filter by `user_id = userId` explicitly (defense-in-depth alongside RLS) and order `listWatches` by `created_at desc`.

#### 2. List/create API route

**File**: `src/pages/api/watches/index.ts` (new)

**Intent**: `GET` returns the current user's watches as JSON; `POST` validates and creates a new watch.

**Contract**: Both handlers first check `context.locals.user` and return `401 { error }` JSON if absent. `POST` reads a JSON body `{ name: string; photoUrl?: string }`, trims `name`, rejects (400) if empty or over 100 chars, then calls `createWatch`. Responses are `Response.json(...)` with `200`/`201`/`400`/`401`/`500` as appropriate — no redirects (this route is `fetch`-only, unlike the auth routes).

#### 3. Single-watch API route

**File**: `src/pages/api/watches/[id].ts` (new)

**Intent**: `GET` returns one watch owned by the current user, or 404 if missing/not owned.

**Contract**: Checks `context.locals.user` (401 if absent), calls `getWatchById`, returns `404 { error }` when no row is found (RLS + explicit `user_id` filter both prevent cross-user access — a miss is indistinguishable from "not yours").

### Success Criteria:

#### Automated Verification:

- `npm run build` completes without type errors
- `npm run lint` passes

#### Manual Verification:

- `curl` (with a valid session cookie) against `GET /api/watches`, `POST /api/watches`, and `GET /api/watches/{id}` return the expected shapes and status codes
- Requesting any of these routes while signed out returns `401` JSON, not a redirect
- Requesting another user's watch id returns `404`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Collection List Page

### Overview

Add the protected `/collection` route with an SSR-fetched initial list, the card grid / empty state, and navigation entry points.

### Changes Required:

#### 1. Protected route registration

**File**: `src/middleware.ts`

**Intent**: Guard the new page the same way `/dashboard` is guarded.

**Contract**: Add `"/collection"` to the `PROTECTED_ROUTES` array.

#### 2. Collection page

**File**: `src/pages/collection/index.astro` (new)

**Intent**: Server-render the initial watch list for fast first paint, then hand off to a client component for interactivity (add dialog, live refresh).

**Contract**: Uses `createClient` + `listWatches` to fetch the current user's watches server-side, passes them as a serialized prop to a `client:load` React component (Phase 5's `CollectionView`).

#### 3. Nav entry points

**File**: `src/pages/dashboard.astro`, `src/components/Topbar.astro`

**Intent**: Make `/collection` reachable — dashboard becomes a light landing page per the confirmed nav decision, and the signed-in Topbar gets a persistent link.

**Contract**: `dashboard.astro` keeps the welcome/sign-out block but adds a primary CTA link/button to `/collection`. `Topbar.astro`'s signed-in branch gains a `<a href="/collection">Collection</a>` link next to the existing Dashboard/Sign out links.

### Success Criteria:

#### Automated Verification:

- `npm run build` completes without type errors
- `npm run lint` passes

#### Manual Verification:

- Visiting `/collection` while signed out redirects to `/auth/signin`
- Visiting `/collection` while signed in with zero watches shows the empty state
- Visiting `/collection` while signed in with existing watches shows them as cards, newest first

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Add-Watch Dialog

### Overview

Build the client-side `CollectionView` + `AddWatchDialog` components: a modal form that optionally uploads a photo directly to Storage, then posts the watch to the API and updates the grid without a full reload.

### Changes Required:

#### 1. `CollectionView` component

**File**: `src/components/collection/CollectionView.tsx` (new)

**Intent**: Own the client-side watch list state, rendering the grid or empty state, and reconciling it after a successful add.

**Contract**: Props `{ initialWatches: Watch[] }`. Holds watches in `useState`, seeded from `initialWatches`. Renders `EmptyCollectionState` when empty, otherwise a responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) of `WatchCard`s, plus a persistent "Add watch" button that opens `AddWatchDialog`. On the dialog's success callback, prepends the new watch to local state (optimistic) — no full re-fetch needed since the API response already returns the created row.

#### 2. `AddWatchDialog` component

**File**: `src/components/collection/AddWatchDialog.tsx` (new)

**Intent**: Collect a name (required) and optional photo file, upload the photo directly to Supabase Storage from the browser, then POST the watch via the JSON API.

**Contract**: Uses shadcn `Dialog` + `Input` + `Label` + the existing `Button`. Client-side validation mirrors `SignUpForm`'s pattern (trim/length check on name; file type/size check against the bucket's `image/jpeg|png|webp` / 5MB limits before attempting upload). On submit: if a file is selected, call `createBrowserSupabaseClient()`, build the path `${user.id}/${crypto.randomUUID()}.${ext}`, `upload()` to the `watch-photos` bucket, then `getPublicUrl()` for the resulting path; POST `{ name, photoUrl }` (photoUrl omitted if no file) to `/api/watches`; on success, call the passed `onCreated(watch)` callback and close the dialog. Surface upload/API errors inline (reusing `ServerError`'s visual pattern) rather than failing silently.

### Success Criteria:

#### Automated Verification:

- `npm run build` completes without type errors
- `npm run lint` passes

#### Manual Verification:

- Adding a watch with only a name succeeds and appears in the grid immediately
- Adding a watch with a photo succeeds, the photo uploads, and the card shows the image
- Submitting an empty name shows a client-side validation error and does not call the API
- Selecting an oversized/wrong-type file shows a client-side error and does not attempt the upload
- A second local test account cannot see the first account's newly added watch

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 6: Watch Detail Page

### Overview

Add the minimal single-watch detail view.

### Changes Required:

#### 1. Detail page

**File**: `src/pages/collection/[id].astro` (new)

**Intent**: Show one watch's photo (or placeholder), name, and creation date; this is intentionally minimal per FR-006's MVP note — no wear-session history section, since that data doesn't exist until S-04.

**Contract**: Uses `createClient` + `getWatchById` server-side. Returns a 404 response (Astro's `Astro.rewrite("/404")` or equivalent) when the watch is missing or not owned by the current user. Renders photo/placeholder, name as heading, and `created_at` formatted as a locale date string, plus a back link to `/collection`.

### Success Criteria:

#### Automated Verification:

- `npm run build` completes without type errors
- `npm run lint` passes

#### Manual Verification:

- Opening a watch card from the grid navigates to its detail page with correct data
- Visiting another user's watch id (or a nonexistent id) shows a 404, not the watch's data
- Visiting `/collection/{id}` while signed out redirects to `/auth/signin`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

No test framework is configured (per `AGENTS.md`) — out of scope for this change.

### Integration Tests:

None automated; the manual verification steps per phase cover the end-to-end flows.

### Manual Testing Steps:

1. `npm run supabase:start` and `npm run supabase:db:push` to apply the new Storage migration
2. Sign in with a local test account, visit `/collection` — confirm empty state
3. Add a watch with only a name — confirm it appears immediately
4. Add a watch with a photo — confirm upload succeeds and the image renders in the grid and detail page
5. Open the detail page for each watch — confirm correct data
6. Sign in with a second test account — confirm `/collection` shows no watches from the first account, and a direct link to the first account's watch id 404s
7. Sign out and visit `/collection` and `/collection/{id}` directly — confirm redirect to `/auth/signin`

## Performance Considerations

Collection sizes are small (single-user MVP, PRD target scale is "small" data volume) — no pagination needed yet. The `idx_watches_user_id` index from F-01 covers the list query's filter.

## Migration Notes

Only additive: one new Storage migration. No changes to the `watches`/`wear_sessions` schema or existing rows.

## References

- Roadmap S-02: `context/foundation/roadmap.md`
- PRD requirements FR-004, FR-005, FR-006: `context/foundation/prd.md`
- Schema foundation: `supabase/migrations/20260630000000_watches_and_wear_sessions.sql`
- Auth pattern reference: `src/pages/api/auth/signup.ts`, `src/components/auth/SignUpForm.tsx`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Storage & Client Foundations

#### Automated

- [x] 1.1 Migration applies cleanly (db push/reset) — d2e3ef6
- [x] 1.2 watch-photos bucket row exists with public = true — d2e3ef6
- [x] 1.3 3 storage RLS policies exist for watch-photos — d2e3ef6
- [x] 1.4 npm run build passes — d2e3ef6
- [x] 1.5 npm run lint passes — d2e3ef6

#### Manual

- [x] 1.6 Bucket visible and public in Studio — d2e3ef6
- [x] 1.7 3 policies visible in Studio — d2e3ef6

### Phase 2: Shared UI Primitives

#### Automated

- [x] 2.1 npm run build passes — d5cc7f9
- [x] 2.2 npm run lint passes — d5cc7f9

#### Manual

- [x] 2.3 WatchCard renders correctly with and without photo — d5cc7f9
- [x] 2.4 EmptyCollectionState matches app visual style — d5cc7f9

### Phase 3: Watches Data Access & API Routes

#### Automated

- [x] 3.1 npm run build passes — 0b224fc
- [x] 3.2 npm run lint passes — 0b224fc

#### Manual

- [x] 3.3 GET/POST /api/watches and GET /api/watches/{id} return expected shapes/status codes — 0b224fc
- [x] 3.4 Signed-out requests return 401 JSON — 0b224fc
- [x] 3.5 Requesting another user's watch id returns 404 — 0b224fc

### Phase 4: Collection List Page

#### Automated

- [x] 4.1 npm run build passes — b916b26
- [x] 4.2 npm run lint passes — b916b26

#### Manual

- [x] 4.3 Signed-out visit to /collection redirects to /auth/signin — b916b26
- [x] 4.4 Signed-in empty collection shows empty state — b916b26
- [x] 4.5 Signed-in non-empty collection shows cards newest-first — b916b26

### Phase 5: Add-Watch Dialog

#### Automated

- [x] 5.1 npm run build passes
- [x] 5.2 npm run lint passes

#### Manual

- [x] 5.3 Add watch with name only succeeds and appears immediately
- [x] 5.4 Add watch with photo succeeds and image renders
- [x] 5.5 Empty name shows client-side validation error
- [x] 5.6 Oversized/wrong-type file shows client-side error, no upload attempted
- [x] 5.7 Second test account cannot see first account's new watch

### Phase 6: Watch Detail Page

#### Automated

- [ ] 6.1 npm run build passes
- [ ] 6.2 npm run lint passes

#### Manual

- [ ] 6.3 Card click navigates to correct detail page
- [ ] 6.4 Other user's/nonexistent watch id shows 404
- [ ] 6.5 Signed-out visit redirects to /auth/signin
