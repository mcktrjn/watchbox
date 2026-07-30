<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Wear Session Tracking

- **Plan**: context/changes/wear-session-tracking/plan.md
- **Scope**: All 4 phases (full plan)
- **Date**: 2026-07-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical | 2 warnings | 5 observations

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

### F1 — Hard delete on sessions vs soft delete on watches

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/lib/wear-sessions.ts:82-93
- **Detail**: `deleteSession` performs a hard `DELETE` on `wear_sessions`, while `deleteWatch` in `watches.ts` performs a soft delete (sets `deleted_at`). The schema confirms `wear_sessions` has no `deleted_at` column, so hard delete is the only option — but this is a semantic divergence. If a watch is soft-deleted (restorable), its wear sessions are permanently gone.
- **Fix**: Document this tradeoff in `lessons.md` so future schema changes to add soft-delete to sessions are considered if watch-restore is ever implemented. No code change needed.
- **Decision**: PENDING

### F2 — GET returns `[]` for non-existent watch instead of 404

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: src/pages/api/watches/[id]/sessions/index.ts:25-30
- **Detail**: The `GET` handler calls `listSessions` which returns an empty array if the watch doesn't exist or doesn't belong to the user. The caller gets `[]` with status 200, indistinguishable from a valid watch with no sessions. The reference pattern `watches/[id].ts` explicitly checks `if (!watch) { return 404 }`.
- **Fix**: Add a lightweight existence check for the watch before listing sessions. Since the route is nested under `/api/watches/[id]/` and the UI only navigates here from a valid watch page, the practical risk is low.
- **Decision**: PENDING

### F3 — Missing `noValidate` on add-session form

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/collection/AddSessionDialog.tsx:131
- **Detail**: The `<form>` element does not include the `noValidate` attribute. Both `AddWatchDialog.tsx` and `EditWatchDialog.tsx` use `noValidate` on their forms. Without it, browser-native validation can show native tooltip popups that bypass the app's styled error messages.
- **Fix**: Add `noValidate` to the `<form>` element to match the existing pattern and ensure consistent error UX.
- **Decision**: FIXED — Added `noValidate` to `<form>` element.

### F4 — No 404 handling on client for DELETE race condition

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: src/components/collection/WearSessionList.tsx:130-148
- **Detail**: The `handleDelete` function treats any non-ok response as an error. The `DELETE` API returns 404 if the session doesn't exist (e.g., already deleted in another tab). The client would show "Failed to delete session" even though the desired end state (session gone) is already achieved.
- **Fix**: Treat 404 from DELETE as success — session is already gone. Update the `if (!response.ok)` check to handle 404 as a non-error.
- **Decision**: FIXED — Added 404-as-success handling in `handleDelete`.

### F5 — Plain `<button>` elements instead of `Button` component for icon actions

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/collection/WearSessionList.tsx:247, 254
- **Detail**: The edit and delete icon buttons use plain `<button>` elements with `aria-label` instead of the `Button` component from `@/components/ui/button`. The rest of the codebase uses the `Button` component for all interactive elements.
- **Fix**: These are compact inline icon-only buttons where `Button` would add visual padding that disrupts the row layout. Using plain `<button>` with `aria-label` is a reasonable choice for this specific use case. No change needed, but consider creating a small `IconButton` wrapper if this pattern repeats.
- **Decision**: PENDING

### F6 — Overlap detection is client-only with no server-side guard

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Data Safety
- **Location**: src/components/collection/AddSessionDialog.tsx:37-44
- **Detail**: Overlap detection is implemented only on the client side as a soft warning. The server does not check for overlaps before inserting/updating. The plan explicitly accepts this tradeoff ("If the user ignores the warning, overlapping sessions will inflate S-05 statistics"). The DB has no exclusion constraint to prevent overlaps.
- **Fix**: This is an intentional design decision per the plan. No change needed. If statistics accuracy becomes critical, add a `tstzrange` exclusion constraint in a future migration.
- **Decision**: PENDING

### F7 — `listSessions` doesn't guard against soft-deleted watches

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Data Safety
- **Location**: src/lib/wear-sessions.ts:8-18
- **Detail**: `listSessions` filters by `user_id` and `watch_id` but doesn't join against `watches` to check `deleted_at IS NULL`. If a watch is soft-deleted, its sessions are still returned. However, the API route is nested under `/api/watches/[id]/` and the UI only shows sessions for visible watches, so this is unlikely to manifest.
- **Fix**: Consider adding a subquery or join to exclude sessions belonging to soft-deleted watches. Low priority — the UI never navigates to a deleted watch's detail page.
- **Decision**: PENDING
