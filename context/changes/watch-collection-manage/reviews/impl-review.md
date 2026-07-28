<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Watch Collection Manage

- **Plan**: context/changes/watch-collection-manage/plan.md
- **Scope**: All 3 Phases (full plan review)
- **Date**: 2026-07-28
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS ✅ |
| Scope Discipline    | PASS ✅ |
| Safety & Quality    | PASS ✅ |
| Architecture        | PASS ✅ |
| Pattern Consistency | PASS ✅ |
| Success Criteria    | PASS ✅ |

## Findings

### F1 — Validation error message doesn't mention empty-name rejection

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/watches/[id].ts:~54
- **Detail**: The PUT handler validates that `name` (when provided) must be non-empty and ≤ 100 chars. The logic correctly catches empty/whitespace-only names with `!name`, but the error message says only `"Name must be 100 characters or fewer"` without mentioning the requirement that it can't be empty. The `index.ts` POST handler, by contrast, uses a combined message: `"Name is required and must be 100 characters or fewer"` — more precise about both constraints.
- **Fix**: Update the error message to match the `index.ts` pattern: `"Name is required and must be 100 characters or fewer"` (when empty or too long) or split into two distinct messages for the two cases.
- **Decision**: FIXED — split into two distinct checks: empty name → `"Name is required"` (400), too long → `"Name must be 100 characters or fewer"` (400).

## Verdict Details

### Plan Adherence — PASS ✅

All 3 phases were implemented as described:

- **Phase 1**: Migration adds `deleted_at TIMESTAMPTZ`, changes FK to `ON DELETE NO ACTION`, adds index. `database.types.ts` regenerated with `deleted_at: string | null`. All confirmed in the diff.
- **Phase 2**: `listWatches`/`getWatchById` filter `.is("deleted_at", null)`. `updateWatch`/`deleteWatch` helpers added. PUT/DELETE handlers in `[id].ts` with proper auth, validation, and 404 handling via `PGRST116` detection.
- **Phase 3**: `EditWatchDialog.tsx` created as separate component mirroring `AddWatchDialog`. Delete confirmation inline in `WatchDetailClient.tsx` with correct text. Action buttons (Edit/Delete) wired in the client island — `client:load` on `WatchDetailClient`.

### Scope Discipline — PASS ✅

All items from "What We're NOT Doing" are respected:

- No archive/restore UI — not present.
- No hard delete — soft delete only.
- No edit/delete on `WatchCard` in the grid — actions only on detail page.
- No shared form logic extraction — `EditWatchDialog` and `AddWatchDialog` remain separate.
- No changes to Storage bucket policies or upload path convention.

Only expected files changed. No EXTRA files detected (excluding plan/docs).

### Safety & Quality — PASS ✅

- **Security**: No injection vectors. All DB queries use Supabase JS SDK (parameterized). All API routes authenticate via `context.locals.user`. Photo uploads go through browser Supabase client (RLS-scoped). No hardcoded secrets.
- **Performance**: `deleted_at` filter benefits from `idx_watches_deleted_at` index. No N+1 or unbounded operations. Photo upload limits (5MB, type-checked) prevent abuse.
- **Reliability**: All API handlers have try/catch with proper error responses. `PGRST116` (0 rows) is handled as 404 for both PUT and DELETE. Edit dialog cleans up uploaded photo if PUT fails. Old photo cleanup on edit is best-effort (non-blocking). Submit buttons disabled during async operations.
- **Data safety**: Soft-delete is an `UPDATE` on `watches`, never a `DELETE`. FK changed from `CASCADE` to `NO ACTION` as a defensive measure. `deleteWatch` has `.is("deleted_at", null)` to prevent double-delete race conditions.

### Architecture — PASS ✅

- Bottom-up layering (migration → data layer → API → UI) per plan.
- `WatchDetailClient` correctly wraps both dialogs, managing state in a single client island — avoids needing multiple `client:load` directives on the Astro page.
- API routes independently check auth (correct — middleware doesn't protect `/api/*`).
- `EditWatchDialog` follows the established `AddWatchDialog` architecture: direct-to-Storage upload, then API call.

### Pattern Consistency — PASS ✅

- `EditWatchDialog.tsx` closely mirrors `AddWatchDialog.tsx` in structure, validation, error handling, and upload pattern.
- `@/` path alias used throughout — no relative imports.
- API handlers follow the same `APIRoute` signature, auth-check, null-check-supabase, try/catch pattern.
- `watch.ts` helpers follow the same `SupabaseClient<Database>` + userId pattern as existing functions.
- `new Date().toISOString()` for `deleted_at` — consistent with typical Supabase patterns.

### Success Criteria — PASS ✅

#### Automated Verification:

- `npm run build` — ✅ PASS (completed with only a benign CSS minify warning about `file` property)
- `npm run lint` — ✅ PASS (no errors or warnings)

#### Manual Verification:

All manual checklist items in Progress are marked `[x]` with commit references. Key behaviors verified in the code:

- Edit dialog pre-fills with current name ✅
- New photo replaces old, cleanup best-effort ✅
- Validation errors block submit ✅
- Delete with confirmation redirects to `/collection` ✅
- Deleted watch excluded from queries via `.is("deleted_at", null)` ✅
- RLS respected (user_id scoped queries) ✅
