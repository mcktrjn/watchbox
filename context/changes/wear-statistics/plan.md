# Wear Statistics — Implementation Plan

## Overview

Add a dedicated statistics page (`/stats`) that visualizes wear data as horizontal bar charts using Recharts, computed via server-side SQL aggregation. Users toggle between week/month/year periods and between "Hours worn" / "Sessions" metrics. This is the North Star feature — the first complete end-to-end flow that proves wear-tracking is useful, from data entry (S-04) to insight (S-05).

## Current State Analysis

- **`wear_sessions` table** exists with full RLS, `CHECK (ended_at > started_at)`, and indexes on `user_id`, `watch_id`, and `started_at`. FK to `watches` is `ON DELETE NO ACTION` (soft-delete migration applied).
- **`watches` table** has `deleted_at` column for soft delete. All existing queries filter `WHERE deleted_at IS NULL`.
- **Wear session CRUD** is fully implemented: `src/lib/wear-sessions.ts`, API routes under `src/pages/api/watches/[id]/sessions/`, and UI in `WatchDetailClient.tsx`.
- **No statistics code exists yet** — no lib, no API endpoint, no page, no charting dependency.
- **Navigation** has `/collection` and `/dashboard` routes, both in `PROTECTED_ROUTES`. `Topbar.astro` links to both.
- **Middleware** protects routes via a `PROTECTED_ROUTES` array — just add `/stats` to it.
- **No charting library** is installed. The stack is Astro + React + Tailwind + shadcn/ui.

### Key Discoveries

- Overlapping sessions are only caught client-side (soft warning in S-04) — the statistics query uses naive `SUM(ended_at - started_at)` and accepts the risk of inflated totals from overlapping sessions.
- The `idx_wear_sessions_started_at` index already exists and will be used by the period-filtered aggregation query.
- The existing API pattern (auth guard → validate → delegate to lib → JSON response) is consistent across `src/pages/api/watches/index.ts` and `src/pages/api/watches/[id].ts` — the statistics endpoint follows the same template.

## Desired End State

A logged-in user navigates to `/stats` and sees:

- A **period toggle** (Week | Month | Year) at the top.
- A **summary card**: most-worn watch (name + hours), total wear hours across all watches, and count of distinct watches worn in the period.
- A **metric toggle** switching between "Hours worn" and "Sessions" views.
- A **horizontal bar chart** ranking watches from most-worn to least-worn, with watch names on the Y axis and values on the X axis, including hover tooltips.
- An **empty state** when the user has watches but no sessions: explanatory message + link to collection page.
- The page handles the case where the user has no watches at all (generic empty state).

All data is computed server-side via a single SQL aggregation query that filters by `user_id`, `started_at >= period_start`, and `watches.deleted_at IS NULL`. Only active watches with at least one session appear in the chart. No client-side computation of totals — the API returns pre-aggregated rows.

## What We're NOT Doing

- **Custom date ranges** — the PRD specifies week/month/year only. A date picker or arbitrary range is out of scope.
- **Time-series / trend charts** — the PRD asks for ranking (which watches are worn most/least), not how wear patterns change over time.
- **Pie/donut charts** — horizontal bars only, as decided in questioning.
- **Bulk statistics across all users** — this is a per-user feature. No admin dashboard.
- **Export or sharing** — statistics are view-only, in-app.
- **Overlap detection or correction in statistics** — naive SUM, accepting the S-04 tradeoff.

## Implementation Approach

Server-side SQL aggregation → API endpoint → React chart component → Astro page. The aggregation query runs in `src/lib/statistics.ts` using the Supabase client. The API endpoint (`GET /api/stats?period=week|month|year`) returns pre-aggregated rows. The React component fetches on mount and renders the chart.

Recharts is installed as a new dependency. The bar chart component uses `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, and `ResponsiveContainer` from Recharts.

## Critical Implementation Details

- **Period boundaries**: "Week" = last 7 days (including today), "Month" = last 30 days, "Year" = last 365 days. The API computes `period_start` server-side from the current UTC date — the client sends only `period` enum, never dates.
- **Duration calculation**: `EXTRACT(EPOCH FROM (ended_at - started_at)) / 3600` in SQL, summed per watch. The API returns hours as a float (e.g., `42.5`). The client formats it for display.
- **Soft-delete filter**: The aggregation query must JOIN `watches` and filter `WHERE watches.deleted_at IS NULL`. Watches with no sessions in the period are excluded from results (not shown as zeros).

## Phase 1: Data Layer & API

### Overview

Create the statistics computation library and the API endpoint that serves aggregated data to the client.

### Changes Required

#### 1. Statistics lib module

**File**: `src/lib/statistics.ts` (new)

**Intent**: Provide a single function that computes per-watch wear statistics for a given user and period. Runs a SQL aggregation query via Supabase.

**Contract**:

- `Period` type: `"week" | "month" | "year"`
- `StatRow` type: `{ watchId: string; watchName: string; totalHours: number; sessionCount: number }`
- `getStats(supabase, userId, period): Promise<StatRow[]>` — computes `period_start` as `NOW() - INTERVAL`, then runs:

```sql
SELECT
  ws.watch_id as "watchId",
  w.name as "watchName",
  SUM(EXTRACT(EPOCH FROM (ws.ended_at - ws.started_at)) / 3600) as "totalHours",
  COUNT(*)::int as "sessionCount"
FROM wear_sessions ws
JOIN watches w ON w.id = ws.watch_id AND w.deleted_at IS NULL
WHERE ws.user_id = <userId>
  AND ws.started_at >= <periodStart>
GROUP BY ws.watch_id, w.name
ORDER BY "totalHours" DESC
```

The function constructs the query using the Supabase client's `.select()` with a raw filter for the interval comparison, or falls back to `.rpc()` if the ORM chaining can't express the JOIN + interval filter cleanly. The returned rows are ordered by `totalHours DESC` — the client renders them in this order.

#### 2. Statistics API endpoint

**File**: `src/pages/api/stats.ts` (new)

**Intent**: `GET /api/stats?period=week|month|year` — auth guard, validate period, delegate to `getStats()`, return JSON array of `StatRow`.

**Contract**:

- Auth guard (401 if no user)
- `createClient()` null-check (500 if unconfigured)
- Parse `period` from `context.url.searchParams` — validate it's one of `"week" | "month" | "year"` (400 with `{ error: "period must be week, month, or year" }` if invalid or missing)
- Call `getStats(supabase, user.id, period)` → 200 JSON array
- Errors caught and returned as 500 `{ error: "..." }`

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification

- `curl GET /api/stats?period=week` with valid auth → 200 + JSON array of `StatRow`
- `curl GET /api/stats?period=invalid` → 400 error
- `curl GET /api/stats` (no auth) → 401
- Create wear sessions for 2 watches → verify both appear in response with correct totals

---

## Phase 2: Chart Components

### Overview

Build React components for the statistics UI: the main view with period/metric toggles, summary card, and bar chart; plus an empty state component. Install Recharts as a dependency.

### Changes Required

#### 1. Install Recharts

**File**: `package.json` (edit)

**Intent**: Add Recharts as a project dependency for bar chart rendering.

**Contract**: Run `npm install recharts`. This adds `recharts` to `dependencies` in `package.json` and updates `package-lock.json`.

#### 2. Stats view component

**File**: `src/components/statistics/StatsView.tsx` (new)

**Intent**: The main statistics view. Fetches `/api/stats?period=...` on mount and on period change. Renders the period toggle, summary card, metric toggle, and horizontal bar chart. Shows loading spinner during fetch.

**Contract**:

- Props: none (self-contained — fetches its own data)
- State: `period` (`"week" | "month" | "year"`), `metric` (`"hours" | "sessions"`), `stats: StatRow[]`, `loading`, `error`
- Period toggle: three shadcn/ui `Button` variants (one `default`, others `outline`) in a horizontal group, labeled "Week", "Month", "Year"
- Metric toggle: two buttons toggling between "Hours" and "Sessions", same pattern as period toggle but visually distinct (e.g., smaller, positioned near the chart)
- Summary card: a bordered card above the chart showing:
  - Most-worn watch: `${watchName} — ${formattedHours}h`
  - Total hours: sum of all `totalHours`, formatted to 1 decimal
  - Distinct watches: `stats.length`
  - If `stats` is empty, the summary card shows "No data for this period" and the chart area shows the empty state
- Bar chart (Recharts):
  - `ResponsiveContainer` wrapping `BarChart` with `layout="vertical"`
  - `YAxis` with `dataKey="watchName"`, `type="category"`, `width` wide enough for watch names
  - `XAxis` with `type="number"` and appropriate unit label ("hours" or "sessions")
  - `Bar` with `dataKey` of `metric === "hours" ? "totalHours" : "sessionCount"`, using the app's gradient (blue-to-purple) for fill
  - `Tooltip` showing the watch name and formatted value
  - Data sorted descending by the active metric (already sorted by `totalHours` from the API; re-sort client-side when metric toggles to sessions)
- Loading state: centered `Loader2` spinner
- Error state: red error text with retry button

#### 3. Empty stats state component

**File**: `src/components/statistics/EmptyStatsState.tsx` (new)

**Intent**: Shown when the user has watches but no wear sessions exist (empty `stats` array). Displays an explanation and a CTA linking to the collection page.

**Contract**:

- Props: none
- Message: "No wear data yet. Log your first wear session to see statistics here."
- CTA: Link styled as a button pointing to `/collection`

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification

- Load `/stats` with sessions → period toggle switches data, chart re-renders
- Metric toggle switches between hours and sessions, bar values update
- Summary card shows correct most-worn watch, total hours, distinct count
- Hover tooltips show watch name and value
- Empty state renders when user has watches but zero sessions
- Loading spinner appears during fetch

---

## Phase 3: Page & Navigation

### Overview

Create the `/stats` Astro page, wire it into navigation, and add it to the protected routes.

### Changes Required

#### 1. Statistics page

**File**: `src/pages/stats.astro` (new)

**Intent**: A protected page that renders the statistics view. Follows the same layout pattern as `src/pages/collection/index.astro`.

**Contract**:

- Uses `Layout.astro` with title "Statistics"
- Renders `Topbar` and the `StatsView` component with `client:load`
- The page itself does not fetch data — `StatsView` handles that client-side
- Wrapper div with `bg-cosmic min-h-screen p-4 sm:p-8` and `max-w-3xl` centered content

#### 2. Topbar — add Statistics link

**File**: `src/components/Topbar.astro` (edit)

**Intent**: Add a "Statistics" link between "Dashboard" and "Collection" in the navigation bar.

**Contract**: Add an `<a href="/stats">` link in the same style as the existing Dashboard and Collection links, positioned between them. Use the same CSS classes: `text-purple-300 transition-colors hover:text-purple-100 hover:underline`.

#### 3. Middleware — protect /stats route

**File**: `src/middleware.ts` (edit)

**Intent**: Add `/stats` to `PROTECTED_ROUTES` so unauthenticated users are redirected to sign-in.

**Contract**: Change `["/dashboard", "/collection"]` to `["/dashboard", "/collection", "/stats"]`.

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npx astro check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification

- Navigate to `/stats` while logged in → page renders with period toggle and chart (or empty state)
- Navigate to `/stats` while logged out → redirected to `/auth/signin`
- Click "Statistics" in Topbar → navigates to `/stats`
- Click between Dashboard, Statistics, and Collection links → all work
- Mobile: page is responsive, chart resizes, toggles wrap cleanly

---

## Testing Strategy

### Manual Testing Steps

1. Fresh user with no watches: visit `/stats` → empty state (or generic message)
2. User with watches but no sessions: visit `/stats` → `EmptyStatsState` with CTA to collection
3. Add 2-3 wear sessions across different watches → visit `/stats` → bar chart shows correct ranking
4. Toggle between Week / Month / Year → chart updates with correct data for each period
5. Toggle between Hours / Sessions → bars switch metric, order updates
6. Summary card shows correct most-worn watch and totals
7. Add a session for today → "Week" period includes it immediately
8. Soft-delete a watch that has sessions → it disappears from stats
9. Verify RLS: log in as different user → only own watches appear
10. Log out → `/stats` redirects to sign-in

---

## Performance Considerations

- The aggregation query runs against `wear_sessions` with a `WHERE started_at >= period_start` filter using the existing `idx_wear_sessions_started_at` index — efficient even as session counts grow.
- The API returns at most one row per active watch — for a typical collector (5-50 watches), the response is tiny (< 5KB).
- Recharts renders SVG — for 50 bars, rendering is sub-100ms. No virtualization needed.
- The page fetches data client-side on mount. No server-side data fetching in the Astro page — keeps the initial page load fast (shell only, no DB wait).

---

## References

- PRD: `context/foundation/prd.md` — FR-011, US-01
- Roadmap: `context/foundation/roadmap.md` — S-05
- Schema migration: `supabase/migrations/20260630000000_watches_and_wear_sessions.sql`
- Soft-delete migration: `supabase/migrations/20260728000000_watches_soft_delete.sql`
- Database types: `src/lib/database.types.ts`
- Pattern reference — watches lib: `src/lib/watches.ts`
- Pattern reference — wear sessions lib: `src/lib/wear-sessions.ts`
- Pattern reference — watches API: `src/pages/api/watches/index.ts`
- Pattern reference — collection page: `src/pages/collection/index.astro`
- Pattern reference — middleware: `src/middleware.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Data Layer & API

#### Automated

- [x] 1.1 TypeScript compilation passes: `npx astro check` — 4e77f32
- [x] 1.2 Linting passes: `npm run lint` — 4e77f32

#### Manual

- [x] 1.3 `curl GET /api/stats?period=week` returns correct aggregated data — 4e77f32

### Phase 2: Chart Components

#### Automated

- [x] 2.1 TypeScript compilation passes: `npx astro check` — 7c295ba
- [x] 2.2 Linting passes: `npm run lint` — 7c295ba

#### Manual

- [x] 2.3 Period toggle switches data, chart re-renders correctly — 7c295ba
- [x] 2.4 Metric toggle switches between hours and sessions — 7c295ba
- [x] 2.5 Empty state renders when user has watches but zero sessions — 7c295ba

### Phase 3: Page & Navigation

#### Automated

- [x] 3.1 TypeScript compilation passes: `npx astro check` — daeb742
- [x] 3.2 Linting passes: `npm run lint` — daeb742
- [x] 3.3 Build succeeds: `npm run build` — daeb742

#### Manual

- [x] 3.4 `/stats` renders correctly when logged in — daeb742
- [x] 3.5 `/stats` redirects to sign-in when logged out — daeb742
- [x] 3.6 Navigation links work between all pages — daeb742
