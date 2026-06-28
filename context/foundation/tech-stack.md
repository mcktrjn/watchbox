---
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
---

## Why this stack

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
