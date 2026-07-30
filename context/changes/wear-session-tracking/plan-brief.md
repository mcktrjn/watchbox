# Wear Session Tracking — Plan Brief

> Full plan: `context/changes/wear-session-tracking/plan.md`

## What & Why

Implement full CRUD for wear sessions — register, edit, and delete wearing sessions for a watch — surfaced as a chronological timeline on the watch detail page. This is S-04 in the roadmap, the last prerequisite before S-05 (statistics — the North Star of the product). Without this, there are no sessions to compute statistics from.

## Starting Point

The `wear_sessions` table already exists with RLS, a `CHECK (ended_at > started_at)` constraint, indexes, and generated TypeScript types. The watches CRUD (`src/lib/watches.ts` + `src/pages/api/watches/` + dialog components) provides a proven pattern to follow. The watch detail page (`WatchDetailClient.tsx`) is a client-side React island ready to host the session list.

## Desired End State

A user opens a watch detail page and sees, below the watch card, a chronological list of wear sessions — each showing date, time range, and a duration badge. They can add sessions via a dialog (date + HH:MM start/end), edit sessions inline (row transforms into editable fields), and delete with confirmation. An empty state with a CTA appears when no sessions exist yet. Overlapping sessions trigger a soft warning but are allowed. All times are stored as UTC and displayed in the user's local timezone.

## Key Decisions Made

| Decision             | Choice                             | Why (1 sentence)                                                                            | Source |
| -------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------- | ------ |
| UX layout            | Timeline list below watch card     | Natural reading order — watch first, then its history; matches existing detail page layout. | Plan   |
| Time input           | Date picker + two HH:MM inputs     | Matches PRD spec exactly; date and time are separate concerns.                              | Plan   |
| Overlapping sessions | Allow with soft UI warning         | Real life is messy — blocking overlaps would frustrate users correcting past entries.       | Plan   |
| Date scope           | Past and today only                | Wear tracking is retrospective; future dates undermine data trustworthiness.                | Plan   |
| Timezone handling    | UTC storage, local display         | Schema already uses TIMESTAMPTZ; correct for users in any timezone.                         | Plan   |
| Session row info     | Date + time range + duration badge | Gives the full picture at a glance; duration badge reinforces the tracking value prop.      | Plan   |
| Edit UX              | Inline edit in the list row        | Fast and contextual — user stays oriented in the timeline.                                  | Plan   |
| Empty state          | Prompt with CTA button             | Educates the user about the feature and drives them toward the core value prop.             | Plan   |

## Scope

**In scope:**

- CRUD API routes for wear sessions (nested under `/api/watches/[id]/sessions/`)
- Session list on watch detail page with date, time range, and duration
- Add session dialog with date + time inputs
- Inline edit and delete with confirmation
- Empty state with CTA
- Overlap detection with soft warning
- Server-side validation (date ≤ today, end > start)

**Out of scope:**

- Statistics/charts (S-05)
- Bulk operations, session notes/tags, pagination
- Multi-watch session view

## Architecture / Approach

Follows the established watches CRUD pattern: **lib → API → UI**.

```
src/lib/wear-sessions.ts          ← typed CRUD functions (new)
src/pages/api/watches/[id]/sessions/
  index.ts                        ← GET list + POST create (new)
  [sessionId].ts                  ← PUT update + DELETE (new)
src/components/collection/
  AddSessionDialog.tsx            ← add dialog (new)
  WearSessionList.tsx             ← timeline + inline edit (new)
  EmptySessionState.tsx           ← empty state CTA (new)
  WatchDetailClient.tsx           ← wire sessions section (edit)
```

Sessions are fetched client-side after mount — the Astro page only server-renders watch data (existing behavior). All mutations go through `fetch()` to API routes, not direct Supabase calls.

## Phases at a Glance

| Phase            | What it delivers                                       | Key risk                                                              |
| ---------------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| 1. Data Layer    | `src/lib/wear-sessions.ts` with typed CRUD functions   | Low — follows existing `watches.ts` pattern exactly                   |
| 2. API Routes    | REST endpoints for session CRUD with validation        | Low — follows existing watches API pattern                            |
| 3. UI Components | Add dialog, session list with inline edit, empty state | Medium — inline edit state management is the most complex React logic |
| 4. Integration   | Wire everything into `WatchDetailClient`               | Low — straightforward composition of already-built components         |

**Prerequisites:** F-01 (database schema), S-01 (auth), S-02 (watch collection view) — all done.
**Estimated effort:** ~1–2 sessions across 4 phases.

## Open Risks & Assumptions

- **Inline edit complexity**: Transforming a list row into editable fields in-place requires careful state management (only one row editable at a time, cancel reverts, save updates optimistically). This is the highest-risk UI piece.
- **Overlap detection is client-only**: The server doesn't check for overlaps — only the client warns. If the user ignores the warning, overlapping sessions will inflate S-05 statistics. This is an accepted tradeoff.
- **No timezone preference**: The app uses the browser's local timezone for display. If the user travels, displayed times shift. No user-level timezone setting exists yet.

## Success Criteria (Summary)

- User can add a wear session from the watch detail page and see it appear in the timeline
- User can edit a session's times inline and see the row update
- User can delete a session with confirmation
- Invalid inputs (future date, end before start) are rejected with clear messages
- Sessions persist across page refreshes and are scoped to the owning user (RLS)
