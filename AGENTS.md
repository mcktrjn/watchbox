# Repository Guidelines

Watchbox is a watch-collection management web app for collectors, built with Astro v6 (SSR, Cloudflare Workers adapter), React v19, Tailwind CSS v4, and Supabase for auth and persistence.

## Hard Rules

- Access `SUPABASE_URL` and `SUPABASE_KEY` only via `import … from "astro:env/server"` — never `process.env` or `import.meta.env`.
- `createClient()` in `@/lib/supabase` returns `null` when Supabase is unconfigured; always null-check the result before use.
- Add protected routes to the `PROTECTED_ROUTES` array in `src/middleware.ts`; do not guard individual pages manually.
- Use the `@/` path alias (resolves to `src/`) for all intra-project imports — never `../../` relative imports.

## Project Structure

- `src/layouts/` — Astro layouts
- `src/pages/` — Astro pages; `src/pages/api/` for server API endpoints (`.ts` files)
- `src/components/` — `.astro` for static/layout components, `.tsx` for interactive React components
- `src/lib/` — shared utilities: `supabase.ts`, `utils.ts`, `config-status.ts`
- `src/middleware.ts` — auth guard; reads Supabase session, populates `context.locals.user`
- `supabase/` — local Supabase config (`config.toml`)
- `context/` — PRD, shape-notes, tech-stack docs (agent reference only; do not modify)

## Build and Development Commands

- `npm run dev` — start dev server (Cloudflare workerd runtime via wrangler)
- `npm run build` — production build
- `npm run lint` — ESLint with TypeScript strict, Astro, and React rules
- `npm run lint:fix` — auto-fix ESLint issues
- `npm run format` — Prettier across all file types

## Coding Style & Naming

- TypeScript strict mode via `astro/tsconfigs/strict`; JSX runtime is React (`jsxImportSource: "react"`).
- Use `.astro` for layout/page/static components; `.tsx` for interactive React components. Do not add client-side interactivity directly to `.astro` files.
- Pre-commit hooks (husky + lint-staged) run ESLint on `.ts/.tsx/.astro` and Prettier on `.json/.css/.md`. Run `npm run lint` before pushing to avoid hook failures.
- `no-console` is a lint warning — remove `console.*` calls before committing.

## Testing

No test framework is configured yet. Add one before writing tests.

## Security & Configuration

- Local dev secrets go in `.dev.vars` (gitignored); see @README.md for first-time Supabase setup.
- `SUPABASE_URL` and `SUPABASE_KEY` are declared as `server`/`secret` in @astro.config.mjs — they are never sent to the client.

## Commit Guidelines

No commit-message convention is established (history uses single-digit commit messages only). Define one before the first team PR.
