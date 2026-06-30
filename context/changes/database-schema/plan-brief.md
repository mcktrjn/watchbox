# Watches & Wear Sessions Schema — Plan Brief

> Full plan: `context/changes/database-schema/plan.md`

## What & Why

Watchbox needs two domain tables — `watches` and `wear_sessions` — before any product slice can store or query data. This change (F-01 from the roadmap) creates those tables with Row Level Security, a `moddatetime` audit trigger, and the migration tooling workflow. Nothing in S-02 through S-05 can proceed without it.

## Starting Point

`supabase/migrations/` does not exist yet. The Supabase CLI is installed (`supabase@^2.23.4`), the local config is in place (`supabase/config.toml`), and auth is fully wired — but the database has no domain tables and no TypeScript types have been generated.

## Desired End State

A single SQL migration applies cleanly to a fresh local stack and to the remote Supabase project. Both tables enforce per-user row isolation at the database level. TypeScript database types are generated into `src/lib/database.types.ts`. An RLS test script in `supabase/tests/rls.sql` verifies cross-user isolation and passes with zero leaked test data.

## Key Decisions Made

| Decision                     | Choice                                                           | Why (1 sentence)                                                                                               | Source  |
| ---------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------- |
| `watches` columns            | Lean MVP: id, user_id, name, photo_url, created_at, updated_at   | PRD FR-004 requires name + optional photo only; adding speculative columns now creates dead schema             | Plan    |
| Timestamp strategy           | `started_at TIMESTAMPTZ` + `ended_at TIMESTAMPTZ`                | Industry-standard for event boundaries; client constructs full datetime in S-04                                | Plan    |
| Photo field                  | `photo_url TEXT NULL`                                            | Bucket setup deferred to S-02 where upload workflow is scoped                                                  | Plan    |
| Audit timestamps             | `updated_at` + `moddatetime` trigger on both tables              | S-03 (edit watch) and S-04 (edit session) benefit from last-modified tracking without app-layer overhead       | Plan    |
| Delete cascade               | `wear_sessions → watches ON DELETE CASCADE` (provisional)        | OQ-1 is unresolved; CASCADE is the MVP default; must be revisited before S-05                                  | Roadmap |
| Wear session ownership check | INSERT/UPDATE policies verify `watch_id` belongs to current user | Without this, a user could pollute another user's statistics by creating sessions on their watches             | Plan    |
| TypeScript types             | Generate into `src/lib/database.types.ts`                        | Future slices get typed queries from day one; strict TypeScript catches schema mismatches at compile time      | Plan    |
| RLS verification             | SQL test script (`supabase/tests/rls.sql`) in a transaction      | Repeatable, version-controlled, leaves no test data; documents the isolation invariant for future contributors | Plan    |

## Scope

**In scope:**

- `supabase/migrations/<timestamp>_watches_and_wear_sessions.sql` — tables, extension, triggers, RLS policies, indexes
- npm scripts for Supabase workflow (`supabase:start`, `supabase:stop`, `supabase:migration:new`, `supabase:db:push`, `db:types`)
- `src/lib/database.types.ts` — generated TypeScript types
- `supabase/tests/rls.sql` — RLS verification script

**Out of scope:**

- Supabase Storage bucket (deferred to S-02)
- Any application code — API routes, components, forms
- Down migration
- Seed data

## Architecture / Approach

All DDL lives in one migration file, ordered to satisfy PostgreSQL dependency rules: `moddatetime` extension → `watches` table → `wear_sessions` table → triggers → RLS → indexes. `wear_sessions.user_id` is denormalized from the watch owner to keep RLS simple and queries fast. The INSERT/UPDATE policies on `wear_sessions` include an `EXISTS` subquery to verify watch ownership — the only non-trivial RLS clause.

## Phases at a Glance

| Phase                | What it delivers                                                | Key risk                                                                                                                |
| -------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1. SQL Migration     | Migration file with tables, triggers, 8 RLS policies, 4 indexes | Incorrect trigger/extension ordering causes migration failure                                                           |
| 2. Developer Tooling | npm scripts + generated `database.types.ts`                     | `db:types` requires local stack running; type gen must happen after migration is applied                                |
| 3. RLS Verification  | `supabase/tests/rls.sql` passes; zero test data leaked          | Complex `SET LOCAL role` + `request.jwt.claims` boilerplate; `auth.users` insert may require additional NOT NULL fields |

**Prerequisites:** Docker Desktop running (for local Supabase stack), `supabase link` configured for remote push  
**Estimated effort:** ~1 session across 3 phases

## Open Risks & Assumptions

- OQ-1 (cascade vs. archive vs. block on watch delete) is provisionally CASCADE — must be resolved before `/10x-plan wear-statistics`
- `auth.users` table schema may require additional NOT NULL columns when inserting synthetic test users in `rls.sql`; adjust the INSERT statement if the migration succeeds but the test script errors on user creation
- PostgreSQL `TIMESTAMPTZ` stores in UTC — S-04 must send timezone-aware datetimes from the client; this is documented in the plan as a known S-04 constraint

## Success Criteria (Summary)

- `psql $LOCAL_DB_URL -c "SELECT tablename FROM pg_policies WHERE tablename IN ('watches','wear_sessions')"` returns 8 distinct policy rows
- `npm run db:types` writes a non-empty `src/lib/database.types.ts` containing `watches` and `wear_sessions` type definitions
- `psql $LOCAL_DB_URL -f supabase/tests/rls.sql` exits 0 and prints `ROLLBACK` as its final line
