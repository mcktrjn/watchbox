# Auth Flow Implementation Plan

## Overview

Verify and complete the email+password auth flow end-to-end on Cloudflare Workers. The full scaffold (~90%) is already in place; this plan fills four concrete gaps and runs a full verification cycle to confirm the flow is production-ready before S-02 begins.

## Current State Analysis

All structural pieces are present: three API routes (`signin.ts`, `signup.ts`, `signout.ts`), three UI pages (`signin.astro`, `signup.astro`, `confirm-email.astro`), React form components with client-side validation, middleware with `/dashboard` redirect guard, and `Topbar.astro` with conditional auth links.

**Gaps found:**

- `.dev.vars` is missing — `createClient()` returns `null` locally because `SUPABASE_URL`/`SUPABASE_KEY` are unset
- Post-signin redirect goes to `/` (line 15 of `signin.ts`) instead of `/dashboard`
- Auth pages (`/auth/signin`, `/auth/signup`) do not redirect already-authenticated users
- `confirm-email.astro` uses `import.meta.env.DEV` which is unreliable under Cloudflare workerd; env detection should use `SUPABASE_URL` localhost check instead
- No `/auth/confirm` callback route — when email confirmation is enabled in production, Supabase sends a `?token_hash=…&type=email` link with no handler to exchange it

### Key Discoveries:

- `src/lib/supabase.ts` already uses `@supabase/ssr` `createServerClient` correctly with `parseCookieHeader` — no changes needed
- `supabase/config.toml` has `enable_confirmations = false` — email confirmation is off locally, so the `/auth/confirm` route only matters for production deployment
- `SUPABASE_URL` is declared `optional: true` in `astro.config.mjs` — all accesses must handle `undefined`
- `wrangler.jsonc` includes `nodejs_compat` compatibility flag — required by `@supabase/ssr`, already present
- `middleware.ts` populates `context.locals.user` on every request — auth pages can use `Astro.locals.user` to check current auth state

## Desired End State

- A new user can sign up → land on the confirm-email page with the correct message for the current environment
- A returning user can sign in → land on `/dashboard` with their email displayed
- A signed-in user can sign out → land on the home page
- Visiting `/dashboard` without auth → redirected to `/auth/signin`
- Visiting `/auth/signin` or `/auth/signup` while signed in → redirected to `/dashboard`
- A production email confirmation link (when confirmation is on) → exchanges token and lands on `/dashboard`

## What We're NOT Doing

- Not modifying dashboard content — the placeholder (welcome message + sign-out) is acceptable for S-01; content is S-02's scope
- Not adding OAuth providers
- Not adding a password-reset flow
- Not changing `PROTECTED_ROUTES` — `/dashboard` is the only protected route in S-01; additional routes are added in later slices
- Not enabling email confirmation locally — `enable_confirmations = false` in `supabase/config.toml` stays as-is

## Implementation Approach

Work in two sequential phases: first make the app connect to Supabase locally (environment), then fix the four code gaps (code fixes). Phase 3 is a manual verification gate — no code changes, just confirmation that all paths work end-to-end before marking S-01 done.

---

## Phase 1: Dev Environment Setup

### Overview

Create `.dev.vars` so the Cloudflare Workers dev runtime has access to `SUPABASE_URL` and `SUPABASE_KEY`. Without this file, `createClient()` returns `null` on every request and the entire auth surface is silently non-functional.

### Changes Required:

#### 1. `.dev.vars`

**File**: `.dev.vars` (project root, gitignored)

**Intent**: Populate with credentials from the running local Supabase instance. `supabase:start` must be running first (last terminal shows it was started — `npm run supabase:start` exit code 0).

**Contract**: Run `npx supabase status` to get the values, then write:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from supabase status output>
```

### Success Criteria:

#### Automated Verification:

- `npm run dev` starts without crashing
- No "Supabase is not configured" redirect on any auth page

#### Manual Verification:

- Home page loads; Topbar shows "Not signed in" with sign-in/sign-up links
- Visiting `/auth/signin` renders the form (not a configuration error redirect)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Code Fixes

### Overview

Four targeted changes: fix the post-signin redirect, add already-authenticated guards to auth pages, fix the `confirm-email.astro` env detection, and add the production email confirmation callback route.

### Changes Required:

#### 1. Post-signin redirect

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Land the user on `/dashboard` after a successful sign-in instead of the home page. Currently `context.redirect("/")` on line 15.

**Contract**: Change the success redirect from `"/"` to `"/dashboard"`.

#### 2. Already-authenticated redirect — sign-in page

**File**: `src/pages/auth/signin.astro`

**Intent**: If a user who is already signed in navigates to `/auth/signin`, redirect them to `/dashboard` immediately so they don't see a sign-in form while logged in.

**Contract**: In the frontmatter, read `Astro.locals.user`; if truthy, return `Astro.redirect('/dashboard')`. The check must come before any other logic.

#### 3. Already-authenticated redirect — sign-up page

**File**: `src/pages/auth/signup.astro`

**Intent**: Same guard as sign-in: redirect already-authenticated users away from the sign-up form.

**Contract**: Same pattern as change 2 — read `Astro.locals.user`; if truthy, return `Astro.redirect('/dashboard')`.

#### 4. Fix local-dev detection in confirm-email page

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: Replace `import.meta.env.DEV` with a `SUPABASE_URL` localhost check. Under Cloudflare workerd, `import.meta.env.DEV` is `false` even during local development, causing the page to always show "check your email" even when confirmation is disabled.

**Contract**: Import `SUPABASE_URL` from `astro:env/server`. Set:

```ts
const isAutoConfirmed = !!SUPABASE_URL && (SUPABASE_URL.includes("127.0.0.1") || SUPABASE_URL.includes("localhost"));
```

The `!!SUPABASE_URL &&` guard handles the `optional: true` case where the variable may be `undefined`.

#### 5. Email confirmation callback route

**File**: `src/pages/auth/confirm.ts`

**Intent**: Handle the Supabase email confirmation link (GET request with `?token_hash=…&type=email`) sent when email confirmation is enabled in production. Without this route, clicking the confirmation link results in a 404.

**Contract**: Export `GET: APIRoute`. Extract `token_hash`, `type`, and `next` from URL search params. Validate `next` starts with `/` to prevent open-redirect. Call `supabase.auth.verifyOtp({ type, token_hash })`. On success, redirect to `next` (default `/dashboard`). On error or missing params, redirect to `/auth/signin?error=…`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes with no errors on changed files
- `npm run build` completes without TypeScript errors

#### Manual Verification:

- Sign in with valid credentials → browser lands on `/dashboard`
- Visit `/auth/signin` while signed in → browser redirects to `/dashboard`
- Visit `/auth/signup` while signed in → browser redirects to `/dashboard`
- Sign up with a new email → `confirm-email.astro` shows "Registration successful / You can now sign in" (not "Check your email") when running against local Supabase

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: End-to-End Verification

### Overview

Full walk-through of every auth path to confirm the complete flow works before S-01 is declared done and S-02 begins. No code changes in this phase.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes on the full project
- `npm run build` succeeds with zero errors

#### Manual Verification:

- **Happy path — new user**: sign up → confirm-email shows correct environment message → sign in → `/dashboard` shows user email → sign out → home page shows "Not signed in"
- **Happy path — returning user**: sign in with valid credentials → `/dashboard` → sign out → Topbar reflects signed-out state
- **Wrong credentials**: sign in with bad password → stays on `/auth/signin`, error message visible, no redirect
- **Unauthenticated access**: navigate directly to `/dashboard` without being signed in → redirected to `/auth/signin`
- **Already-authenticated guard**: navigate to `/auth/signin` or `/auth/signup` while signed in → redirected to `/dashboard`
- **No regressions**: home page (`/`), Topbar, and layout render without console errors in all auth states

**Implementation Note**: After completing this phase and all automated verification passes, this is the final gate for S-01. Mark `change.md` status as `done` and proceed to S-02.

---

## Testing Strategy

### Manual Testing Steps:

1. Start local Supabase: `npm run supabase:start`
2. Start dev server: `npm run dev`
3. Open `http://localhost:4321` (or the port shown in terminal)
4. Walk through every success-criteria bullet in Phase 3 in order
5. Check browser console for errors during each step
6. Use Supabase Studio (`http://localhost:54323`) → Authentication → Users to verify accounts created during testing

### No Automated Tests Yet:

No test framework is configured in this project. All verification for S-01 is manual. A testing framework should be added before writing automated tests (noted in `AGENTS.md`).

## References

- Roadmap slice S-01: `context/foundation/roadmap.md`
- Supabase SSR cookie pattern: `src/lib/supabase.ts`
- Auth middleware: `src/middleware.ts`
- Supabase local config: `supabase/config.toml`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Dev Environment Setup

#### Automated

- [x] 1.1 `npm run dev` starts without crashing
- [x] 1.2 No "Supabase is not configured" redirect on any auth page

#### Manual

- [x] 1.3 Home page loads; Topbar shows "Not signed in"
- [x] 1.4 Visiting `/auth/signin` renders the form

### Phase 2: Code Fixes

#### Automated

- [ ] 2.1 `npm run lint` passes with no errors on changed files
- [ ] 2.2 `npm run build` completes without TypeScript errors

#### Manual

- [ ] 2.3 Sign in with valid credentials → browser lands on `/dashboard`
- [ ] 2.4 Visit `/auth/signin` while signed in → redirected to `/dashboard`
- [ ] 2.5 Visit `/auth/signup` while signed in → redirected to `/dashboard`
- [ ] 2.6 Sign up with new email → confirm-email shows "Registration successful" (local Supabase)

### Phase 3: End-to-End Verification

#### Automated

- [ ] 3.1 `npm run lint` passes on the full project
- [ ] 3.2 `npm run build` succeeds with zero errors

#### Manual

- [ ] 3.3 Happy path — new user: sign up → confirm-email → sign in → dashboard → sign out
- [ ] 3.4 Happy path — returning user: sign in → dashboard → sign out
- [ ] 3.5 Wrong credentials: error shown, stays on sign-in page
- [ ] 3.6 Unauthenticated access to `/dashboard` → redirected to `/auth/signin`
- [ ] 3.7 Auth-page guard: `/auth/signin` and `/auth/signup` while signed in → `/dashboard`
- [ ] 3.8 No browser console errors in any auth state
