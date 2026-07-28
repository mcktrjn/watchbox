<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Watch Collection View

- **Plan**: context/changes/watch-collection-view/plan.md
- **Scope**: Phase 1-6 of 6 (full plan)
- **Date**: 2026-07-20
- **Verdict**: APPROVED
- **Findings**: 0 critical, 3 warnings, 0 observations (all fixed)

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

## Findings

### F1 — Storage object extension trusts user-controlled filename

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/collection/AddWatchDialog.tsx:114
- **Detail**: The uploaded object's file extension is derived from the user-supplied `file.name` (`file.name.split(".").pop()`) rather than the validated MIME type, falling back to `file.type.split("/")[1]` only when the name has no dot. A file named `payload.php` with a spoofed/valid image MIME type would be stored with a `.php` extension in the public `watch-photos` bucket. The bucket's `allowed_mime_types` and RLS path check don't constrain the extension itself, so this is a real (if low-severity, since Supabase Storage doesn't execute uploaded files) input-trust gap.
- **Fix**: Derive the extension from a fixed MIME-type→extension map (`image/jpeg`→`jpg`, `image/png`→`png`, `image/webp`→`webp`) instead of `file.name`, matching the same `ALLOWED_MIME_TYPES` list already validated in `handleFileChange`.
- **Decision**: FIXED — Added `MIME_TO_EXT` map and replaced `file.name`-based extension derivation.

### F2 — Orphaned storage upload when watch creation fails

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/collection/AddWatchDialog.tsx:130-142
- **Detail**: In `handleSubmit`, if the photo upload to Storage succeeds but the subsequent `POST /api/watches` fails (network error, 400, 500), the uploaded object remains in the `watch-photos` bucket with no owning `watches` row and no cleanup path. Not a cross-user data leak (path is already scoped under the uploader's own `user.id` folder), but it's an unbounded storage leak with no cleanup job anywhere in the codebase.
- **Fix A ⭐ Recommended**: On POST failure (or in a catch block wrapping the whole upload+POST sequence), call `supabase.storage.from(WATCH_PHOTOS_BUCKET).remove([path])` as a best-effort cleanup before surfacing the error.
  - Strength: Symmetric with the upload call already in this same function; no new infrastructure needed.
  - Tradeoff: Best-effort only — if the DELETE itself fails (e.g. network flake) or the tab closes mid-flow, the object still leaks.
  - Confidence: HIGH — small, localized change with no architectural impact.
  - Blind spot: Doesn't address crash/navigation-away between upload and POST; a full fix would need a periodic server-side sweep, which is out of scope for this MVP.
- **Fix B**: Accept as a known MVP limitation (single-user, small data volumes per PRD; no functional bug, just storage bloat) and note it as follow-up work rather than fixing now.
  - Strength: Zero code change; consistent with the plan's explicit "no automated test suite / minimal infra" MVP philosophy.
  - Tradeoff: Storage usage grows unboundedly over time with no cleanup mechanism ever introduced unless revisited.
  - Confidence: MEDIUM — reasonable for now, but debt is easy to forget once shipped.
  - Blind spot: No estimate of how often uploads succeed but the watch-create POST fails in practice.
- **Decision**: FIXED via Fix A — Best-effort `storage.remove([uploadedPath])` cleanup added on POST failure.

### F3 — Storage RLS policies not covered by the existing RLS test file

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: supabase/tests/rls.sql
- **Detail**: `supabase/tests/rls.sql` already establishes a manual, two-user cross-isolation test pattern for the `watches`/`wear_sessions` tables. Phase 1 added three new RLS policies on `storage.objects` for the `watch-photos` bucket (the same ownership-isolation concern, just on a different table), but the test file wasn't extended to assert user B cannot INSERT/UPDATE/DELETE into user A's `{userA}/...` storage path. This isn't "add a test framework" (explicitly out of scope) — it's extending an existing convention this repo already uses for exactly this class of policy.
- **Fix**: Add a section to `supabase/tests/rls.sql`, following its existing structure, asserting user B's write attempts into user A's storage folder are rejected by the three new policies.
- **Decision**: FIXED — Added storage RLS test cases (User A insert + User B INSERT/UPDATE/DELETE denial) following the existing test pattern.
