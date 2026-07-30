# Wear Statistics — Plan Brief

> Full plan: `context/changes/wear-statistics/plan.md`

## What & Why

Add a dedicated statistics page (`/stats`) that visualizes wear data as horizontal bar charts, computed via server-side SQL aggregation. Users toggle between week/month/year periods and between "Hours worn" / "Sessions" metrics. This is the North Star feature — the first complete end-to-end flow that proves wear-tracking is useful, from data entry (S-04) to insight (S-05). Without this, the user has no way to answer the core question: "which watches do I actually wear?"

## Starting Point

All prerequisites are in place: `wear_sessions` table with RLS and indexes, full session CRUD (lib + API + UI on watch detail page), soft-delete for watches (`deleted_at`), and a consistent API pattern across the codebase. The app has `/collection` and `/dashboard` routes with Topbar navigation. No statistics code, charting library, or `/stats` route exists yet.

## Desired End State

A logged-in user visits `/stats` and sees a period toggle (Week | Month | Year), a summary card (most-worn watch, total hours, distinct watches worn), a metric toggle (Hours / Sessions), and a horizontal bar chart ranking watches from most-worn to least-worn. An empty state with explanation and CTA appears when no sessions exist. All data is computed server-side via a single SQL aggregation query.

## Key Decisions Made

| Decision             | Choice                                        | Why (1 sentence)                                                                                                                          | Source |
| -------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Charting library     | Recharts                                      | Best React integration — composable, typed, matches shadcn/ui pattern; 22k+ stars.                                                        | Plan   |
| Aggregation strategy | Server-side SQL (SUM + GROUP BY)              | Minimal data transfer (1 row/watch), scales naturally, uses existing `started_at` index.                                                  | Plan   |
| Page location        | New `/stats` route + Topbar link              | Statistics are the North Star — they deserve a dedicated top-level place, not buried in collection.                                       | Plan   |
| Period UX            | Segmented pill toggle (Week \| Month \| Year) | One-click switching, always visible, matches shadcn/ui toggle pattern.                                                                    | Plan   |
| Chart type           | Horizontal bar chart                          | Best for comparing 5-20 items with readable labels — watch names fit naturally on Y axis.                                                 | Plan   |
| Dual metric display  | Toggle between two bar charts                 | Clean — one chart at a time, no visual overload. User switches between Hours and Sessions.                                                | Plan   |
| Overlap handling     | Naive SUM — accept the risk                   | Overlapping sessions inflate totals, but the user was warned (S-04). Fixing overlaps is a data-quality problem, not a statistics problem. | Plan   |
| Summary card         | Yes — most-worn watch + totals                | Gives immediate insight without reading the chart — matches PRD's ranking intent.                                                         | Plan   |
| Empty state          | Contextual message + CTA to collection        | Educates the user and guides to next action — meets PRD acceptance criterion.                                                             | Plan   |

## Scope

**In scope:**

- `/stats` page with period toggle (week/month/year)
- Summary card (most-worn watch, total hours, distinct watches)
- Metric toggle (hours worn / session count)
- Horizontal bar chart via Recharts
- Server-side SQL aggregation endpoint (`GET /api/stats?period=...`)
- Empty state for users with watches but no sessions
- Topbar navigation link + middleware route protection

**Out of scope:**

- Custom date ranges (date picker)
- Time-series / trend charts
- Pie/donut charts
- Export or sharing
- Overlap detection or correction in statistics
- Admin dashboard or cross-user stats

## Architecture / Approach

```
Browser                    Server (Astro API)              Supabase
──────                     ────────────────                ────────
StatsView.tsx  ──GET──▶   /api/stats?period=week  ──▶   SQL aggregation
(client:load)  ◀──JSON──  (auth guard + validate)  ◀──   JOIN watches
                                                         WHERE deleted_at IS NULL
                                                         GROUP BY watch_id
                                                         ORDER BY totalHours DESC
```

The Astro page (`/stats`) is a shell — it renders the layout and `StatsView` with `client:load`. All data fetching happens client-side. The API endpoint computes period boundaries server-side and runs a single aggregation query. Recharts renders the bar chart from the returned `StatRow[]`.

## Phases at a Glance

| Phase                | What it delivers                                         | Key risk                                                       |
| -------------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Data Layer & API  | `src/lib/statistics.ts` + `GET /api/stats`               | SQL aggregation correctness — verify with manual curl tests    |
| 2. Chart Components  | `StatsView.tsx`, `EmptyStatsState.tsx`, Recharts install | Chart rendering with real data — verify with manual UI testing |
| 3. Page & Navigation | `/stats` page, Topbar link, middleware protection        | Build succeeds on Cloudflare Workers runtime                   |

**Prerequisites:** F-01 (database schema), S-01 (auth), S-02 (watch collection view), S-04 (wear session tracking) — all done.
**Estimated effort:** ~1-2 sessions across 3 phases.

## Open Risks & Assumptions

- **Overlapping sessions inflate totals** — accepted risk from S-04. If this becomes a real problem, the fix is a gaps-and-islands query, not a plan change.
- **Recharts bundle size** — ~200KB gzipped. Acceptable for a single-view SPA, but worth monitoring if more chart-heavy features are added later.
- **Period boundaries are fixed** — "month" = 30 days, not calendar month. This is simpler and matches the PRD's intent of "last month" rather than "January." If users expect calendar-month semantics, this can be adjusted later.

## Success Criteria (Summary)

- User sees a bar chart ranking watches by wear time after logging at least one session
- Period toggle (week/month/year) correctly filters data and re-renders the chart
- Metric toggle switches between hours and session count views
- Empty state with explanation appears when no sessions exist
- Page is protected — unauthenticated users are redirected to sign-in
