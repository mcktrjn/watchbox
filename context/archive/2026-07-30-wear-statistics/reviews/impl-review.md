<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Wear Statistics

- **Plan**: context/changes/wear-statistics/plan.md
- **Scope**: All phases (Phases 1-3 of 3)
- **Date**: 2026-07-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension           | Verdict    |
| ------------------- | ---------- |
| Plan Adherence      | WARNING ⚠️ |
| Scope Discipline    | PASS ✅    |
| Safety & Quality    | PASS ✅    |
| Architecture        | PASS ✅    |
| Pattern Consistency | PASS ✅    |
| Success Criteria    | WARNING ⚠️ |

## Findings

### F1 — Aggregation approach: SQL vs JS (plan drift)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/lib/statistics.ts:1-60
- **Detail**: The plan explicitly specifies a SQL-level aggregation using `SUM(EXTRACT(EPOCH FROM (ended_at - started_at)) / 3600)` and orders by `totalHours DESC`. The implementation fetches all matching rows via the Supabase ORM and aggregates in JavaScript. This is functionally correct but transfers more data over the wire and does computation client-side that could be done in the database. The plan acknowledged this possibility ("or falls back to .rpc() if the ORM chaining can't express the JOIN + interval filter cleanly"), so the drift is documented but not flagged.
- **Fix**: Accept the JS aggregation as a valid fallback since the ORM can't express the SQL aggregation cleanly. The plan already anticipated this. No code change needed — acknowledge the tradeoff.
  - Strength: Avoids RPC complexity; keeps code in the ORM pattern.
  - Tradeoff: Slightly more data transferred; for typical collectors (5-50 watches) this is negligible.
  - Confidence: HIGH — plan explicitly allowed this fallback.
  - Blind spot: Not tested at scale (1000+ sessions per watch); SQL aggregation would be more efficient at scale.
- **Decision**: FIXED — Accepted as valid fallback, no code change needed

### F2 — CustomTooltip payload type mismatch

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/components/statistics/StatsView.tsx:219
- **Detail**: `CustomTooltip` defines `payload` as `{ payload: StatRow; name: string }[]` (required), but Recharts `Tooltip` passes `payload` as `Payload<ValueType, NameType>[] | undefined`. This causes `ts(2739): Type '{}' is missing the following properties from type '{ active: boolean; payload: ... }'`. The `active` and `payload` props should be optional or the component should accept `undefined`.
- **Fix**: Make the props partial — change `{ active: boolean; payload: { payload: StatRow; name: string }[] }` to `{ active?: boolean; payload?: { payload: StatRow; name: string }[] }`.
  - Strength: Matches Recharts' `TooltipProps` contract where both are optional.
  - Tradeoff: None — one-line change with no behavioral impact.
  - Confidence: HIGH — standard Recharts tooltip pattern.
  - Blind spot: None significant.
- **Decision**: FIXED — Made `active` and `payload` optional in CustomTooltip props

### F3 — Unused variable `_totalSessions`

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/components/statistics/StatsView.tsx:102
- **Detail**: `const _totalSessions = stats.reduce(...)` is declared but never read. The `_` prefix suggests an attempt to suppress the lint warning, but `npx astro check` (TypeScript) still flags it as `ts(6133)`.
- **Fix**: Remove the `_totalSessions` declaration entirely — it's not used anywhere in the component.
  - Strength: Eliminates the type-check warning cleanly.
  - Tradeoff: None.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED — Removed unused `_totalSessions` declaration

### F4 — `npx astro check` reports errors (partially pre-existing)

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: (multiple files)
- **Detail**: The plan's automated success criteria require `npx astro check` to pass, but it reports 46 errors. Most are pre-existing (`database.types.ts` has a "Connecting to db 5432" artifact at line 1; `src/lib/watches.ts:71` has a type mismatch). The two new errors from the stats implementation are F2 and F3 above. The plan's Progress section marks "1.1 TypeScript compilation passes" as `[x]` (done), but the command does not pass cleanly.
- **Fix A ⭐ Recommended**: Acknowledge the pre-existing errors as out of scope. Fix the two new errors (F2, F3) to avoid adding to the noise.
  - Strength: Honest accounting; doesn't worsen the existing type-check state.
  - Tradeoff: Pre-existing errors remain for future work to address.
  - Confidence: HIGH — the pre-existing errors are clearly unrelated to this change.
  - Blind spot: Should verify that the pre-existing errors don't affect the build (they don't — `npm run build` succeeds).
- **Fix B**: Fix all errors including pre-existing ones.
  - Strength: Clean slate.
  - Tradeoff: Scope creep — adds unrelated fixes to this change.
  - Confidence: MEDIUM — fixing `database.types.ts` artifact requires understanding how it got there.
  - Blind spot: Might introduce new issues.
- **Decision**: ACCEPTED — Pre-existing errors acknowledged as out of scope; new errors (F2, F3) are fixed
