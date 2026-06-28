---
bootstrapped_at: 2026-06-28T12:14:00Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: watchbox
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: watchbox
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

**Why this stack:**

Watchbox is a solo, after-hours, 3-week MVP for a single-user watch collection
with email/password auth (FR-001–003), per-watch photos (FR-004, FR-007), and a
wear-statistics view (FR-011). The recommended default for `(web, js)` —
Astro + React + TypeScript + Supabase + Cloudflare — ships auth, a Postgres
database with per-user isolation, and photo storage out of the box, so the team
spends its limited hours on the domain stats logic rather than plumbing. It
clears all four agent-friendly gates (typed, convention-based, popular,
well-documented), and its TypeScript-first, convention-driven UI directly serves
the product's aesthetics guardrail. Stats are a standard client-side chart over
Supabase queries — no PRD feature forces a service the starter lacks. Bootstrapper
confidence is first-class, so expect mostly-smooth scaffolding with the occasional
manual step.

---

## Pre-scaffold verification

| Signal      | Value                                                     | Severity | Notes                                                     |
| ----------- | --------------------------------------------------------- | -------- | --------------------------------------------------------- |
| npm package | not run                                                   | n/a      | cmd_template starts with `git clone`; npm check skipped   |
| GitHub repo | przeprogramowani/10x-astro-starter last pushed 2026-05-17 | fresh    | from card.docs_url; fetched via curl (gh CLI unavailable) |

---

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: clone starter repo without keeping its git history (git-clone)
**Exit code**: 0
**`.git/` deletion**: deleted from `.bootstrap-scaffold/` before move-up (upstream history does not leak into project repo)
**Files moved**: 31,442 (includes node_modules)
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: moved silently (no pre-existing .gitignore in cwd)
**.github/ handling**: merged at file level — scaffold added `workflows/ci.yml`; cwd's existing `.github/` content (copilot-instructions.md, skills/, prompts/, .10x-cli-manifest.json) preserved untouched
**`context/` preserved**: yes — no `context/` existed in scaffold; cwd `context/` untouched
**.bootstrap-scaffold cleanup**: deleted

---

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 6 HIGH, 10 MODERATE, 2 LOW
**Direct vs transitive**: 1 HIGH direct (`astro`), 5 HIGH transitive; 3 MODERATE direct (`@astrojs/check`, `supabase`, `wrangler`), 7 MODERATE transitive; all LOW transitive

#### HIGH findings

| Package     | Direct? | Advisory                                                               | Severity | CVSS | Fix                 |
| ----------- | ------- | ---------------------------------------------------------------------- | -------- | ---- | ------------------- |
| `astro`     | yes     | GHSA-8hv8-536x-4wqp — Reflected XSS via unescaped slot name            | HIGH     | 7.1  | upgrade to >=6.3.3  |
| `astro`     | yes     | GHSA-2pvr-wf23-7pc7 — Host header SSRF in prerendered error page fetch | HIGH     | 7.5  | upgrade to >=6.4.6  |
| `devalue`   | no      | GHSA-77vg-94rm-hx3p — DoS via sparse array deserialization             | HIGH     | 7.5  | fixAvailable        |
| `miniflare` | no      | via undici / ws                                                        | HIGH     | —    | fixAvailable        |
| `undici`    | no      | GHSA-vmh5-mc38-953g — TLS cert validation bypass via SOCKS5 proxy      | HIGH     | 7.4  | upgrade to >=7.28.0 |
| `undici`    | no      | GHSA-vxpw-j846-p89q — WebSocket DoS via fragment count bypass          | HIGH     | 7.5  | upgrade to >=7.28.0 |
| `undici`    | no      | GHSA-hm92-r4w5-c3mj — cross-origin routing via SOCKS5 proxy pool reuse | HIGH     | 7.5  | upgrade to >=7.28.0 |
| `vite`      | no      | GHSA-fx2h-pf6j-xcff — server.fs.deny bypass on Windows alternate paths | HIGH     | —    | upgrade to >=7.3.5  |
| `ws`        | no      | GHSA-96hv-2xvq-fx4p — memory exhaustion DoS from tiny fragments        | HIGH     | 7.5  | upgrade to >=8.21.0 |

#### MODERATE findings

| Package                    | Direct? | Advisory                                                                | Severity |
| -------------------------- | ------- | ----------------------------------------------------------------------- | -------- |
| `@astrojs/check`           | yes     | via @astrojs/language-server                                            | MODERATE |
| `@astrojs/language-server` | no      | via volar-service-yaml                                                  | MODERATE |
| `@cloudflare/vite-plugin`  | no      | via miniflare / wrangler / ws                                           | MODERATE |
| `astro`                    | yes     | GHSA-jrpj-wcv7-9fh9 — XSS via unescaped attribute names in spread props | MODERATE |
| `js-yaml`                  | no      | GHSA-h67p-54hq-rp68 — quadratic-complexity DoS in merge key handling    | MODERATE |
| `supabase`                 | yes     | via tar                                                                 | MODERATE |
| `tar`                      | no      | GHSA-vmf3-w455-68vh — PAX size override file smuggling                  | MODERATE |
| `undici`                   | no      | GHSA-p88m-4jfj-68fv — HTTP header injection via Set-Cookie              | MODERATE |
| `undici`                   | no      | GHSA-pr7r-676h-xcf6 — cross-user info disclosure via shared cache       | MODERATE |
| `vite`                     | no      | GHSA-v6wh-96g9-6wx3 — NTLMv2 hash disclosure via UNC path on Windows    | MODERATE |
| `volar-service-yaml`       | no      | via yaml-language-server                                                | MODERATE |
| `wrangler`                 | yes     | via esbuild / miniflare                                                 | MODERATE |
| `yaml`                     | no      | GHSA-48c2-rrv3-qjmp — stack overflow via deeply nested YAML collections | MODERATE |
| `yaml-language-server`     | no      | via yaml                                                                | MODERATE |

#### LOW / INFO findings

| Package       | Direct? | Advisory                                                                 | Severity | CVSS |
| ------------- | ------- | ------------------------------------------------------------------------ | -------- | ---- |
| `@babel/core` | no      | GHSA-4x5r-pxfx-6jf8 — arbitrary file read via sourceMappingURL comment   | LOW      | 3.2  |
| `esbuild`     | no      | GHSA-g7r4-m6w7-qqqr — arbitrary file read in dev server on Windows       | LOW      | 2.5  |
| `undici`      | no      | GHSA-35p6-xmwp-9g52 — HTTP response queue poisoning via keep-alive reuse | LOW      | 3.7  |
| `undici`      | no      | GHSA-g8m3-5g58-fq7m — Set-Cookie SameSite attribute downgrade            | LOW      | 3.7  |

---

## Hints recorded but not acted on

| Hint                      | Value                |
| ------------------------- | -------------------- |
| `bootstrapper_confidence` | first-class          |
| `quality_override`        | false                |
| `path_taken`              | standard             |
| `self_check_answers`      | null                 |
| `team_size`               | solo                 |
| `deployment_target`       | cloudflare-pages     |
| `ci_provider`             | github-actions       |
| `ci_default_flow`         | auto-deploy-on-merge |
| `has_auth`                | true                 |
| `has_payments`            | false                |
| `has_realtime`            | false                |
| `has_ai`                  | false                |
| `has_background_jobs`     | false                |

These values were read and preserved in this audit trail. No automated scaffolding decision was made from them in v1. A future skill (M1L4 "Memory Architecture") will act on deployment target, CI provider, and feature flags when generating `AGENTS.md` / `CLAUDE.md`.

---

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- `git init` (if you have not already) to start your own repo history. Note: a `.git/` directory already exists in this cwd — if it is the project repo, you are all set; if it was pre-existing from a parent workspace checkout, inspect it before committing scaffold files.
- Run `npm audit fix` to address the 16 auto-fixable advisories. Use `npm audit fix --force` for the remaining breaking-change fixes (review the changelog for `astro` and `wrangler` before forcing).
- Review the `.github/workflows/ci.yml` the starter added — it is a CI template for the Cloudflare Pages deploy flow matching your `ci_default_flow: auto-deploy-on-merge` hint.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
