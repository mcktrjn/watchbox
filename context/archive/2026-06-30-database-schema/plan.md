# Watches & Wear Sessions Schema Implementation Plan

## Overview

Establish the database foundation for Watchbox: two domain tables (`watches`, `wear_sessions`) with Row Level Security enforcing per-user data isolation, a `moddatetime` trigger for audit timestamps, and the migration + developer tooling workflow that all subsequent slices (S-02, S-03, S-04, S-05) depend on.

## Current State Analysis

- `supabase/migrations/` does not exist — no migration files have been written yet
- `watches` and `wear_sessions` tables do not exist in the database
- No TypeScript database types are generated
- Supabase CLI (`supabase@^2.23.4`) is present in `devDependencies`
- Supabase Storage is enabled in `supabase/config.toml` but no bucket is needed for this change
- Auth is fully wired: `src/lib/supabase.ts` and `src/middleware.ts` reference `auth.users` via Supabase SSR; `auth.uid()` is available for RLS policies
- `wrangler.jsonc` has no D1 bindings — no conflicts with Cloudflare

## Desired End State

After this plan is applied:

- `supabase/migrations/<timestamp>_watches_and_wear_sessions.sql` exists and applies cleanly to a fresh local stack
- Running `supabase db push` against a remote project applies the migration without errors
- Both tables enforce per-user isolation at the database level: querying as user A returns zero rows owned by user B
- `src/lib/database.types.ts` is generated and exports typed `watches` and `wear_sessions` row types
- `supabase/tests/rls.sql` passes when run against the local stack, asserting the cross-user isolation invariant

### Key Discoveries

- `moddatetime` is a first-party Supabase/PostgreSQL extension bundled with all Supabase projects — no additional install needed
- `auth.uid()` is the canonical Supabase function for resolving the current user in RLS policies — already used in the auth layer (`src/lib/supabase.ts`)
- The provisional CASCADE decision (OQ-1 from roadmap) is reflected in the `wear_sessions → watches` FK via `ON DELETE CASCADE`; must be revisited before S-05 planning
- PostgreSQL `TIMESTAMPTZ` is stored in UTC; the client (S-04) must combine date + HH:MM + user's local timezone when constructing the `started_at` / `ended_at` payload — this is a known S-04 constraint, not a schema problem
- `wear_sessions.user_id` is denormalized from `watches.user_id` — this simplifies RLS and avoids join-based policy overhead; the INSERT/UPDATE policies must verify watch ownership to prevent a user from creating sessions on another user's watch

## What We're NOT Doing

- Supabase Storage bucket creation — deferred to S-02 (photo upload workflow)
- Seed data / test fixtures — the RLS test script is the only verification artifact
- Any application code (API routes, components, forms) — those belong to S-02, S-03, S-04
- A `down` migration — rolling back in early dev means manually dropping tables
- GraphQL custom resolvers — Supabase auto-exposes the tables; no customisation needed for MVP

## Implementation Approach

Single SQL migration file containing all DDL in dependency order: extension → tables → triggers → RLS policies → indexes. TypeScript types are generated after applying the migration to the local stack. RLS is verified by a SQL test script that runs inside a transaction and rolls back, leaving the local database clean and the test repeatable.

## Critical Implementation Details

**Wear session INSERT/UPDATE policy requires watch ownership check.** The `wear_sessions` INSERT and UPDATE policies must verify not only `user_id = auth.uid()` but also that the referenced `watch_id` belongs to the current user. Without this, a user who knows another user's `watch_id` UUID could create sessions on that watch. The sessions would be invisible to the attacker (SELECT RLS blocks them) but would pollute the victim's statistics. The `WITH CHECK` clause must be:

```sql
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM watches
    WHERE watches.id = watch_id AND watches.user_id = auth.uid()
  )
)
```

**`moddatetime` extension must precede table definitions.** In a single migration file, `CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions` must appear before any `CREATE TRIGGER … moddatetime(updated_at)` call, or the migration will error.

---

## Phase 1: SQL Migration

### Overview

Write the migration file that creates the `watches` and `wear_sessions` tables, enables the `moddatetime` extension, attaches update triggers, enables RLS, creates all 8 policies, and adds 4 indexes.

### Changes Required

#### 1. Migration file

**File**: `supabase/migrations/20260630000000_watches_and_wear_sessions.sql`

**Intent**: Create the canonical first migration for the project, establishing both domain tables with all constraints, triggers, RLS policies, and indexes. This is the authoritative schema that all future slices reference.

**Contract**: DDL must appear in this order to satisfy PostgreSQL dependency rules:

1. `CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;`

2. `watches` table columns: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `name TEXT NOT NULL`, `photo_url TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

3. `wear_sessions` table columns: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `watch_id UUID NOT NULL REFERENCES watches(id) ON DELETE CASCADE`, `started_at TIMESTAMPTZ NOT NULL`, `ended_at TIMESTAMPTZ NOT NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `CONSTRAINT chk_ended_after_started CHECK (ended_at > started_at)`

4. Triggers — one `BEFORE UPDATE FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at')` trigger per table

5. RLS on `watches` — `ALTER TABLE watches ENABLE ROW LEVEL SECURITY` + 4 policies:
   - SELECT: `USING (auth.uid() = user_id)`
   - INSERT: `WITH CHECK (auth.uid() = user_id)`
   - UPDATE: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
   - DELETE: `USING (auth.uid() = user_id)`

6. RLS on `wear_sessions` — `ALTER TABLE wear_sessions ENABLE ROW LEVEL SECURITY` + 4 policies; INSERT and UPDATE use the extended ownership `WITH CHECK` described in Critical Implementation Details

7. Indexes: `CREATE INDEX idx_watches_user_id ON watches(user_id)`, `CREATE INDEX idx_wear_sessions_user_id ON wear_sessions(user_id)`, `CREATE INDEX idx_wear_sessions_watch_id ON wear_sessions(watch_id)`, `CREATE INDEX idx_wear_sessions_started_at ON wear_sessions(started_at)`

### Success Criteria

#### Automated Verification

- `npm run supabase:start` completes without errors
- `npm run supabase:db:push` (or `supabase db reset`) applies the migration without SQL errors
- `psql $LOCAL_DB_URL -c "\dt public.*"` lists both `watches` and `wear_sessions`
- `psql $LOCAL_DB_URL -c "SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('watches','wear_sessions') ORDER BY tablename, policyname"` returns 8 rows
- `npm run lint` passes

#### Manual Verification

- Open Supabase Studio (http://127.0.0.1:54323) → Table Editor → confirm both tables exist with the correct columns and types
- Studio → Authentication → Policies → confirm all 8 policies are listed under their respective tables

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Developer Tooling

### Overview

Add convenience npm scripts for the Supabase workflow, then generate TypeScript types from the applied migration into `src/lib/database.types.ts`. This gates all future slices on having typed database access from day one.

### Changes Required

#### 1. npm scripts

**File**: `package.json`

**Intent**: Add 5 Supabase workflow scripts so the local dev commands are self-documenting and don't require developers to recall `npx` prefixes.

**Contract**: Add to the `"scripts"` object:

```json
"supabase:start": "supabase start",
"supabase:stop": "supabase stop",
"supabase:migration:new": "supabase migration new",
"supabase:db:push": "supabase db push",
"db:types": "supabase gen types typescript --local > src/lib/database.types.ts"
```

#### 2. TypeScript database types

**File**: `src/lib/database.types.ts` (generated — do not hand-write)

**Intent**: Run `npm run db:types` to generate a type-safe representation of the database schema. Future API routes and components import from this file for `watches` and `wear_sessions` row types. The file must exist before S-02 begins writing queries.

**Contract**: The generated file exports a `Database` type compatible with `@supabase/supabase-js` generics, enabling `SupabaseClient<Database>` usage. The type wiring into the Supabase client constructor happens in S-02, not here — this change only ensures the file exists with the correct generated content.

### Success Criteria

#### Automated Verification

- `npm run db:types` exits with code 0 and writes a non-empty `src/lib/database.types.ts`
- `src/lib/database.types.ts` contains `watches` and `wear_sessions` table row type definitions (grep for both strings)
- `npm run lint` passes
- `npm run build` completes without type errors

#### Manual Verification

- Open `src/lib/database.types.ts` — confirm `Tables<'watches'>` and `Tables<'wear_sessions'>` row shapes match the migration columns

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: RLS Verification

### Overview

Write a SQL test script that runs inside a transaction, creates two synthetic users, asserts that each can only see and mutate their own data, and rolls back — leaving the local DB clean. This script is the primary regression guard for data isolation.

### Changes Required

#### 1. RLS test script

**File**: `supabase/tests/rls.sql`

**Intent**: Provide a repeatable, version-controlled script that asserts the core isolation invariant at the database layer: user A cannot read, insert into, update, or delete rows owned by user B. The assertions catch any future accidental RLS regression.

**Contract**: The script must:

1. Open with `BEGIN;` and close with `ROLLBACK;` so it leaves no test data
2. Insert two rows into `auth.users` with deterministic UUIDs (e.g. `'00000000-0000-0000-0000-000000000001'` and `'...0002'`); include all required `NOT NULL` columns (`created_at`, `updated_at`, `raw_app_meta_data`, `raw_user_meta_data`, `is_super_admin`, `encrypted_password`)
3. Simulate user A with `SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claims" TO '{"sub":"<uuid-1>","role":"authenticated"}'`
4. Insert 1 watch for user A; assert `(SELECT COUNT(*) FROM watches) = 1` (user A sees it)
5. Switch to user B with the same `SET LOCAL` pattern using `uuid-2`
6. Assert `(SELECT COUNT(*) FROM watches) = 0` (user B cannot see user A's watch — RLS isolation confirmed)
7. Assert that inserting a `wear_session` for user B using user A's `watch_id` raises an exception (ownership check in INSERT policy fires)
8. Use `DO $$ BEGIN ASSERT <condition>, '<message>'; END $$;` for each assertion so a failure aborts with a descriptive message

### Success Criteria

#### Automated Verification

- `psql $LOCAL_DB_URL -f supabase/tests/rls.sql` exits with code 0

#### Manual Verification

- The final line of output when running `psql $LOCAL_DB_URL -f supabase/tests/rls.sql` is `ROLLBACK` — confirms no test data leaked
- Running `psql $LOCAL_DB_URL -c "SELECT COUNT(*) FROM watches"` immediately after returns 0

---

## Testing Strategy

### Unit Tests

No unit test framework is configured (see AGENTS.md). Out of scope for this change.

### Integration Tests

- `supabase/tests/rls.sql` covers SELECT, INSERT, and cross-user isolation for both tables
- Running `supabase db reset` against the migration file is the integration smoke test for schema correctness

### Manual Testing Steps

1. Start local stack: `npm run supabase:start`
2. Apply migration: `npm run supabase:db:push`
3. Verify tables and policies in Supabase Studio → http://127.0.0.1:54323
4. Generate types: `npm run db:types` — confirm `src/lib/database.types.ts` is populated
5. Run RLS test: `psql $LOCAL_DB_URL -f supabase/tests/rls.sql` — confirm all assertions pass
6. Confirm zero test data leaked: `psql $LOCAL_DB_URL -c "SELECT COUNT(*) FROM watches"` returns 0

## Performance Considerations

All 4 indexes are created at migration time. The statistics queries in S-05 (FR-011) primarily filter on `user_id` + `started_at` range; both columns are indexed. For a typical collector with ~50 watches and ~1000 sessions, query times will be well under the < 1 s p95 NFR from the PRD.

## Migration Notes

- **Rolling forward only**: No down migration for MVP. Rolling back means manually dropping the tables — acceptable in early development.
- **Migration naming**: Supabase CLI requires the `YYYYMMDDHHMMSS_` prefix. Use the creation timestamp for the filename.
- **Remote push**: `supabase db push` requires the project to be linked via `supabase link`. Ensure `SUPABASE_DB_PASSWORD` is available before pushing to production.
- **OQ-1 reminder**: The provisional `ON DELETE CASCADE` on `wear_sessions → watches` must be re-evaluated before S-05 planning, as noted in `context/foundation/roadmap.md`.

## References

- Roadmap F-01: `context/foundation/roadmap.md`
- PRD requirements FR-004, FR-008, FR-009, FR-010, FR-011: `context/foundation/prd.md`
- Supabase client: `src/lib/supabase.ts`
- Supabase local config: `supabase/config.toml`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: SQL Migration

#### Automated

- [x] 1.1 supabase:start completes without errors
- [x] 1.2 supabase:db:push applies migration without SQL errors
- [x] 1.3 Both tables visible via \dt public.\*
- [x] 1.4 8 RLS policies present in pg_policies for watches and wear_sessions
- [x] 1.5 npm run lint passes

#### Manual

- [x] 1.6 Both tables visible with correct columns in Supabase Studio
- [x] 1.7 All 8 RLS policies visible in Studio → Authentication → Policies

### Phase 2: Developer Tooling

#### Automated

- [x] 2.1 npm run db:types exits 0 and writes non-empty src/lib/database.types.ts
- [x] 2.2 database.types.ts contains watches and wear_sessions row types
- [x] 2.3 npm run lint passes
- [x] 2.4 npm run build completes without type errors

#### Manual

- [x] 2.5 Tables<'watches'> and Tables<'wear_sessions'> present in generated types file with expected columns

### Phase 3: RLS Verification

#### Automated

- [x] 3.1 psql $LOCAL_DB_URL -f supabase/tests/rls.sql exits with code 0

#### Manual

- [x] 3.2 Final output of rls.sql script is ROLLBACK (no test data leaked)
- [x] 3.3 SELECT COUNT(\*) FROM watches returns 0 after test script runs
