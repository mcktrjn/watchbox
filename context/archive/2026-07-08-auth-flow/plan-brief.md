# Auth Flow — Plan Brief

> Full plan: `context/changes/auth-flow/plan.md`

## What & Why

Complete the email+password authentication flow end-to-end on Cloudflare Workers before S-02 begins. The full scaffold is already built (~90%); the main risk from the roadmap is **unverified end-to-end behavior with real Supabase on the Cloudflare Workers runtime** — this plan fills four concrete gaps and runs a full manual verification cycle to close that risk.

## Starting Point

All structural pieces are present: three API routes, three UI pages, React form components with client-side validation, middleware with redirect guard, and a Topbar with conditional auth links. `.dev.vars` is missing and the app cannot connect to Supabase locally at all.

## Desired End State

A user can sign up, sign in, and sign out via email+password. Unauthenticated users are redirected away from `/dashboard`; already-authenticated users are redirected away from auth pages. The confirm-email page shows the correct message for the current environment. A production email confirmation link (when confirmation is enabled) resolves via a `/auth/confirm` callback route.

## Key Decisions Made

| Decision                    | Choice                         | Why (1 sentence)                                                                                                         |
| --------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Post-signin redirect        | `/dashboard`                   | User should land on the useful page immediately, not the marketing home page.                                            |
| Email confirmation callback | Add `/auth/confirm` route      | Production readiness requires a `verifyOtp` handler; one extra file now avoids a production 404 later.                   |
| Local dev detection         | `SUPABASE_URL` localhost check | `import.meta.env.DEV` is `false` under Cloudflare workerd even in local dev; URL check works correctly in both runtimes. |
| Already-authenticated guard | Redirect to `/dashboard`       | Showing a sign-in form to a signed-in user is confusing; early frontmatter check is the right fix.                       |
| `.dev.vars` setup           | Include explicit setup step    | Missing credentials are the #1 silent failure mode; plan is self-contained.                                              |
| Dashboard scope             | Keep placeholder as-is         | Dashboard content is S-02's scope; S-01 only needs to prove auth works.                                                  |

## Scope

**In scope:**

- Create `.dev.vars` from running local Supabase instance
- Fix post-signin redirect (`/` → `/dashboard`)
- Add already-authenticated redirect on `/auth/signin` and `/auth/signup`
- Fix `confirm-email.astro` local dev detection
- Add `/auth/confirm` GET route for production email confirmation
- Full end-to-end manual verification

**Out of scope:**

- Dashboard content or UI (S-02)
- Password reset flow
- OAuth providers
- Expanding `PROTECTED_ROUTES` beyond `/dashboard`
- Enabling email confirmation locally

## Architecture / Approach

Three phases in sequence. Phase 1 is environment-only (create `.dev.vars`); Phase 2 is four targeted code changes (one one-liner, two frontmatter guards, one env fix, one new file); Phase 3 is a manual verification gate with no code changes. No data model changes, no new dependencies.

## Phases at a Glance

| Phase                      | What it delivers                                       | Key risk                                                                                                         |
| -------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 1. Dev Environment         | `.dev.vars` created; app connects to local Supabase    | Supabase must be running (`npm run supabase:start`) before credentials can be extracted                          |
| 2. Code Fixes              | 4 gaps closed; lint + build green                      | `astro:env/server` import in `.astro` frontmatter must be verified to work correctly                             |
| 3. End-to-End Verification | Full auth flow confirmed on Cloudflare Workers runtime | Cloudflare workerd cookie behavior differs from standard Node.js — session persistence needs manual confirmation |

**Prerequisites:** Local Supabase running (`npm run supabase:start` ✓ already done)
**Estimated effort:** ~1 session (3 phases, mostly verification)

## Open Risks & Assumptions

- Cookie-based session persistence under Cloudflare workerd is assumed to work — this is the primary unknown that Phase 3 validates
- Production email confirmation requires the Supabase project's "Site URL" and email template redirect URL to be set to the production domain (out of scope; noted for deployment)
- `supabase/config.toml` `site_url` points to port 3000 — Astro dev runs on 4321 — but since `enable_confirmations = false` locally, this has no practical impact on testing

## Success Criteria (Summary)

- A new user can sign up → sign in → reach `/dashboard` → sign out in a single uninterrupted session
- Unauthenticated access to `/dashboard` redirects to `/auth/signin`
- `npm run build` succeeds with zero TypeScript or lint errors
