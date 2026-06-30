---
project: watchbox
researched_at: 2026-06-29
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro v6 + React v19
  runtime: Cloudflare Workers (workerd)
  adapter: "@astrojs/cloudflare v13.5.0"
  database: Supabase (external)
---

## Recommendation

**Deploy on Cloudflare Workers.**

The project already has `@astrojs/cloudflare` v13.5.0 installed, `wrangler.jsonc` configured with the correct v13 entrypoint (`@astrojs/cloudflare/entrypoints/server`), and `nodejs_compat` set — zero adapter changes are required. Cloudflare's free tier covers 100k requests/day (~3M/month), comfortably above any realistic MVP traffic for a solo watch-collection app, and the platform scores Pass on all five agent-friendly criteria including an officially maintained MCP suite. For a stateless request/response SSR app with a single-region user base and external Supabase services, Cloudflare Workers is the fastest path from current codebase to live URL.

## Platform Comparison

| Platform               | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total     |
| ---------------------- | --------- | ------------------ | ------------------- | ----------------- | ----------------- | --------- |
| **Cloudflare Workers** | Pass      | Pass               | Pass                | Pass              | Pass              | **10/10** |
| **Vercel**             | Pass      | Pass               | Pass                | Pass              | Pass              | **10/10** |
| **Railway**            | Pass      | Pass               | Pass                | Pass              | Partial           | **9/10**  |
| **Fly.io**             | Pass      | Partial            | Pass                | Pass              | Pass              | **9/10**  |
| **Netlify**            | Partial   | Pass               | Pass                | Pass              | Partial           | **8/10**  |
| **Render**             | Partial   | Pass               | Pass                | Partial           | Partial           | **7/10**  |

**Scoring notes:**

- **CLI-first (Partial)**: Netlify has no `netlify rollback` CLI command — rollback goes through the UI or REST API. Render's CLI lacks a rollback subcommand and the MCP server cannot trigger deploys. All others support full operational loop from the terminal.
- **Managed/Serverless (Partial)**: Fly.io runs managed micro-VMs with Dockerfiles and `fly.toml` — more moving pieces than a pure serverless surface; appropriate for container workloads but adds operational overhead for a stateless SSR app.
- **MCP / Integration (Partial)**: Railway's MCP server is functional but self-described "work in progress" as of 2026-06-29. Netlify's MCP server (`@netlify/mcp`) has no published releases. Render's hosted MCP server is GA but cannot trigger deploys or manage services — read-only queries only.
- **Stable deploy API (Partial)**: Render's rollback requires the dashboard or REST API call, not a CLI command.

**Soft weights applied (interview answers):**

- Q1 No persistent connections → no hard filter applied; all platforms remain eligible
- Q2 Roughly equal cost/DX → no adjustment
- Q3 No prior familiarity → no tie-breaking applied
- Q4 Single region → no edge-native preference; tie between Cloudflare and Vercel resolved by zero-adapter-swap advantage
- Q5 Don't know yet / external Supabase → slight preference for platforms that work cleanly with external services; no disadvantage identified for any shortlisted platform

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

The strongest fit by a significant margin once the zero-adapter-swap advantage is counted. The project's `wrangler.jsonc` already uses the correct v13 entrypoint and has `nodejs_compat` set. The `astro dev` command already runs against the real `workerd` runtime — the local dev environment matches production exactly. Cloudflare's free tier (100k requests/day) covers the entire expected MVP traffic at no cost. The MCP suite (`*.mcp.cloudflare.com`) is the most mature of any shortlisted platform — multiple domain-specific hosted servers covering observability, bindings, builds, and docs, all GA with no local install. `wrangler deploy` is one-command, deterministic, and returns a versioned deployment URL. Secrets are managed via `wrangler secret put` with no dashboard required.

#### 2. Vercel

Scores equally on the five criteria and is a genuinely strong alternative. The `vercel` CLI covers deploy, rollback, and live log streaming, and `mcp.vercel.com` is a GA hosted MCP server. The Hobby plan is free and covers 1M function invocations/month. The single reason it ranks second rather than first: deploying requires swapping `@astrojs/cloudflare` for `@astrojs/vercel/serverless`, updating `astro.config.mjs`, removing `wrangler.jsonc` from the build pipeline, and re-learning the secrets pattern (`vercel env add` vs `wrangler secret put`). For a 3-week after-hours solo MVP, that migration cost represents real hours that could go toward domain logic.

#### 3. Railway

Container-based PaaS with excellent DX and honest flat pricing ($5/month Hobby, includes $5 usage credit). The CLI covers deploy, redeploy, and log streaming; rollbacks are CLI-accessible via `railway redeploy --deployment <id>` within a 72-hour window. Docs are on GitHub as MDX. The main limitations: requires swapping to `@astrojs/node` standalone adapter and removing all Cloudflare-specific runtime code; MCP server is functional but explicitly marked "work in progress"; and the $5/month floor is a real cost (vs. Cloudflare's $0 at MVP scale).

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **CommonJS dependency failures surface at runtime, not build time.** The `workerd` runtime rejects any npm package using `require()` or `module.exports`. With React v19, `@supabase/ssr` v0.10, and a sizeable UI dependency tree, hitting a CJS transitive dependency is realistic. The error manifests as a runtime 500, not a build error, making it harder to catch in CI.
2. **Per-environment build requirement breaks "build once, deploy anywhere" workflows.** Unlike every other shortlisted platform, Cloudflare requires `CLOUDFLARE_ENV=<env> astro build` for each deployment target. You cannot build a single artifact and promote it from staging to production — each environment needs its own build. In a solo workflow this is minor; in any CI pipeline it's a footgun if the env prefix is omitted.
3. **No native PR preview URLs in Workers.** Cloudflare Pages had per-PR preview URLs as a first-class feature; Workers does not. Branch-based preview environments require manually adding a second `[env.preview]` block in `wrangler.jsonc` and running `wrangler deploy --env preview` — additional setup the project doesn't yet have.
4. **KV eventual consistency.** If any future feature uses Workers KV for session caching or feature flags, data written in one region takes up to 60 seconds to propagate globally. For an app where "single region is fine", this window could affect the only real user if they switch networks or VPN mid-session.
5. **`workerd` has no filesystem.** Any npm package that writes to disk (`tmp`, native addons like `sharp`, `sqlite3`) will throw at runtime. Photo storage must go through Supabase Storage or Cloudflare R2 — it cannot use local disk even temporarily.

### Pre-Mortem — How This Could Fail

The team deployed Watchbox on Cloudflare Workers with confidence — the adapter was already installed, the wrangler config was in the repo, and the first `wrangler deploy` succeeded. The first two days went smoothly. Then the photo upload feature arrived. `sharp`, the natural choice for server-side image resizing before uploading to Supabase Storage, uses native Node binaries that the `workerd` runtime cannot execute. Three hours went into discovering this isn't a configuration issue — it's a fundamental runtime constraint. The team pivoted to client-side resize (limiting quality) or accepted larger uploads, but the architectural decision to "resize on the server" was already in the data model. By week two, a new watch-statistics chart needed a date-formatting library that internally used `require()`. The build succeeded, but production returned a 500 on the statistics page. Debugging required bisecting the dependency tree because the error message only said "require is not defined". The per-environment build requirement then tripped a CI mistake: a push to the `staging` branch ran without `CLOUDFLARE_ENV=staging`, producing a production-configured build that overwrote the staging slot. The stats page showed production Supabase data in the staging environment for two days before anyone noticed. None of these issues were insurmountable — but together they consumed 6 of the 15 available after-hours sessions on infrastructure rather than on the wear-tracking domain logic that was the MVP's stated purpose.

### Unknown Unknowns

- **`astro:env/server` secrets require `wrangler secret put`, not `.env` files.** The `SUPABASE_URL` and `SUPABASE_KEY` declared as `secret` in `astro.config.mjs` are correct for Workers, but the actual values must be loaded via `wrangler secret put SUPABASE_URL` and `wrangler secret put SUPABASE_KEY` before any production deploy. `.env.production` files are ignored by `wrangler deploy`. This distinction isn't obvious when coming from Vercel/Netlify conventions where environment variables and secrets flow through the same `env add` command.
- **`wrangler.jsonc` `name` field is the deployed Worker name, not the project name.** The current `wrangler.jsonc` uses `"name": "10x-astro-starter"` — this will be the live Worker name on Cloudflare's dashboard. Update it to `"name": "watchbox"` before the first deploy, or the dashboard will show a confusingly named worker that can't be easily renamed after deployment without affecting the URL.
- **Supabase `@supabase/ssr` v0.10 cookie helpers use `crypto.subtle` internally.** The `nodejs_compat` flag in `wrangler.jsonc` is already set, which enables the Web Crypto API — this is the correct setup. However, if the flag is ever removed during a `wrangler.jsonc` cleanup, Supabase auth breaks silently with no obvious error message pointing to the missing flag.
- **The Cloudflare free tier is per-account, not per-Worker.** If the developer has other Workers running on the same Cloudflare account (hobby projects, etc.), the 100k requests/day free allowance is shared. A spike on another Worker can eat the Watchbox allocation. At MVP scale this is unlikely to matter, but it's worth knowing the accounting is global.
- **`wrangler tail` streams logs from production Workers in real time but requires the Cloudflare account's API token.** If Wrangler is authenticated locally with `wrangler login`, `wrangler tail` works immediately. But in CI or when an agent runs it, an API token with `Workers Tail` permission must be set via `CLOUDFLARE_API_TOKEN` — the dashboard token scope defaults often omit this permission.

## Operational Story

- **Preview deploys**: Cloudflare Workers has no first-class PR preview URL feature (unlike the discontinued Pages). Create a separate `[env.preview]` block in `wrangler.jsonc` and deploy with `wrangler deploy --env preview` to a `watchbox-preview.<account>.workers.dev` URL. This URL is permanent (not per-PR) and should be protected — add `wrangler access` or restrict to Cloudflare Zero Trust if used for review.
- **Secrets**: Environment variables declared as `secret` in `astro.config.mjs` must be loaded via `wrangler secret put SUPABASE_URL` and `wrangler secret put SUPABASE_KEY` per environment (production, preview). Secrets are stored encrypted in Cloudflare's vault; they are never visible after upload — use `wrangler secret list` to confirm names. Local dev uses `.dev.vars` (gitignored).
- **Rollback**: `wrangler deployments rollback` reverts the production Worker to the previous deployment. Typical time-to-revert is under 30 seconds (global propagation). Database migrations via Supabase do not roll back automatically — any schema change that accompanied the deployment requires a manual migration reversal in Supabase Studio.
- **Approval**: `wrangler deploy` may be run by an agent unattended for code deployments. Secrets rotation (`wrangler secret put`), environment deletion, and any Cloudflare account-level changes (domain routing, Access policies) require a human. Supabase schema migrations are human-only.
- **Logs**: `wrangler tail` streams live production request/error logs to the terminal with no dashboard login required. For structured queries against historical logs, use `observability.mcp.cloudflare.com` (GA MCP server) or the Cloudflare dashboard's Workers Observability view. `wrangler tail --format json` produces structured output suitable for agent parsing.

## Risk Register

| Risk                                                                                          | Source           | Likelihood       | Impact | Mitigation                                                                                                                                            |
| --------------------------------------------------------------------------------------------- | ---------------- | ---------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| CJS npm dependency breaks at runtime in `workerd`                                             | Devil's advocate | Medium           | Medium | Run `npx wrangler dev` locally after each new dependency; add a smoke-test request in CI; audit transitive deps with `node --input-type=module` check |
| Per-environment build misconfiguration promotes wrong artifact to staging                     | Pre-mortem       | Medium           | Low    | Encode `CLOUDFLARE_ENV` in npm scripts (`"build:staging": "CLOUDFLARE_ENV=staging astro build"`); validate env in CI step                             |
| No PR preview URLs out of the box                                                             | Devil's advocate | High (certainty) | Low    | Add a single `[env.preview]` block to `wrangler.jsonc`; document the deploy command in README                                                         |
| Server-side image processing library incompatible with `workerd`                              | Pre-mortem       | Medium           | Medium | For photo uploads: resize on the client before upload (canvas API) or use Cloudflare Images binding; do not add `sharp` or any native binary          |
| `wrangler.jsonc` `name` is "10x-astro-starter" not "watchbox"                                 | Unknown unknowns | High (certainty) | Low    | Rename to `"name": "watchbox"` before first `wrangler deploy`                                                                                         |
| `wrangler secret put` pattern unfamiliar; secrets accidentally omitted from production deploy | Unknown unknowns | Medium           | High   | Add `wrangler secret list` verification step to deploy checklist; document in README under "First deploy"                                             |
| `wrangler tail` API token scope missing `Workers Tail` permission                             | Unknown unknowns | Low              | Low    | Create a scoped API token with `Workers Tail: Edit` + `Workers Scripts: Read`; document in `.dev.vars.example`                                        |
| Free tier request allowance shared across all Workers on the account                          | Unknown unknowns | Low              | Low    | Monitor usage in Cloudflare dashboard; set up usage alert notification at 80k req/day                                                                 |
| `nodejs_compat` flag removed during config cleanup breaks Supabase auth silently              | Unknown unknowns | Low              | High   | Add a comment in `wrangler.jsonc` next to the flag: "required by @supabase/ssr — do not remove"                                                       |

## Getting Started

The project is already configured for Cloudflare Workers deployment. These are the first-deploy steps:

1. **Create a Cloudflare account and authenticate wrangler.**

   ```bash
   npx wrangler login
   ```

   This opens a browser OAuth flow. Once authenticated, `wrangler whoami` confirms the active account.

2. **Rename the Worker before the first deploy** (update `wrangler.jsonc`).
   Change `"name": "10x-astro-starter"` → `"name": "watchbox"`. This sets the live Worker name; it cannot be cleanly renamed after first deploy without re-creating the Worker.

3. **Add production secrets via wrangler** (do not use `.env` files for production).

   ```bash
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_KEY
   ```

   Each command prompts for the value interactively. Confirm with `npx wrangler secret list`.

4. **Build and deploy.**

   ```bash
   npm run build
   npx wrangler deploy
   ```

   On success, wrangler prints the live URL (`watchbox.<account>.workers.dev`). First deploy typically takes under 60 seconds.

5. **Verify with live log tailing.**
   In a second terminal, run `npx wrangler tail` before hitting the live URL. Confirm the first request appears as a `200` with no "require is not defined" or "module not found" errors — this is the CJS-compatibility smoke test.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup (GitHub Actions integration, auto-deploy on push)
- Production-scale architecture (multi-region, HA, DR)
- Cloudflare D1 / R2 as replacements for Supabase (out of scope — external Supabase is the confirmed data layer)
