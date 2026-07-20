# Watch Collection View — Plan Brief

> Full plan: `context/changes/watch-collection-view/plan.md`

## What & Why

Deliver roadmap slice S-02: a signed-in user can add a watch (name + optional photo) to their collection, browse it as a card grid, and open a minimal detail view. This is the first application-layer feature built on the F-01 schema and the first UI screens beyond auth.

## Starting Point

The `watches` table (with RLS) exists but nothing queries it yet. No Storage bucket exists for photos. The Supabase server client isn't typed against the generated schema, and there's no browser Supabase client. The shadcn UI kit is configured but only `Button` has been added.

## Desired End State

A user opens `/collection`, sees their watches as photo-forward cards (or a friendly empty state), adds a new watch through a modal without a page reload, and can click into a minimal detail page showing the photo, name, and add date.

## Key Decisions Made

| Decision          | Choice                                                          | Why (1 sentence)                                                                                           |
| ----------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Photo storage     | New Supabase Storage bucket (`watch-photos`)                    | Matches the tech-stack rationale ("photo storage out of the box"); no extra service.                       |
| Upload path       | Browser uploads directly to Storage                             | Keeps large file bytes off the Cloudflare Worker; RLS on `storage.objects` enforces per-user write access. |
| Bucket visibility | Public read, RLS-restricted write                               | Object paths are per-user UUIDs (impractical to guess); avoids building a signed-URL system for MVP.       |
| Nav placement     | New `/collection` route; dashboard becomes a light landing page | Leaves room for future routes (stats, etc.) instead of overloading "dashboard".                            |
| Add-watch UX      | Modal dialog on the list page                                   | No navigation round-trip; list updates in place.                                                           |
| List layout       | Photo-first card grid                                           | Serves the PRD's aesthetics guardrail directly.                                                            |
| Detail view scope | Minimal — photo, name, created date                             | Matches FR-006's MVP note; avoids speculative UI for wear-session data that doesn't exist until S-04.      |
| API style         | JSON fetch API for `/api/watches*` only                         | Needed for the modal + direct-upload flow; existing auth routes keep their form-POST convention unchanged. |

## Scope

**In scope:** Storage bucket + RLS, typed server client + new browser client, `/collection` list page, add-watch dialog with photo upload, `/collection/[id]` detail page, nav links, required CI/env updates for the new public env vars.

**Out of scope:** Editing/deleting watches (S-03), wear sessions (S-04), statistics (S-05), image resizing/cropping, signed URLs, automated tests (none configured project-wide).

## Architecture / Approach

SSR-first list page (fast initial paint via `listWatches` helper) handing off to a client-side `CollectionView` React island for interactivity. Adding a watch uploads the photo directly from the browser to Supabase Storage (using a new publishable-key browser client), then POSTs the watch record to a new JSON API (`/api/watches`), which is the app's first JSON API convention alongside the existing form-POST auth routes.

## Phases at a Glance

| Phase                           | What it delivers                                                    | Key risk                                                       |
| ------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Storage & client foundations | `watch-photos` bucket + RLS, typed clients, public env vars         | Missing CI env var breaks upload only in production            |
| 2. Shared UI primitives         | shadcn card/dialog/input/label, `WatchCard`, `EmptyCollectionState` | None significant                                               |
| 3. Watches data access & API    | `src/lib/watches.ts`, `/api/watches`, `/api/watches/[id]`           | API routes aren't covered by middleware — must self-check auth |
| 4. Collection list page         | `/collection` route, grid/empty state, nav links                    | —                                                              |
| 5. Add-watch dialog             | Modal + direct-to-storage upload + optimistic update                | Storage RLS path convention mismatch silently 403s             |
| 6. Watch detail page            | `/collection/[id]` minimal view                                     | —                                                              |

**Prerequisites:** F-01 (schema) and S-01 (auth) done — both are.
**Estimated effort:** ~4-6 phases across a few sessions, single developer.

## Open Risks & Assumptions

- Public-read Storage bucket assumes UUID-based object paths are sufficient obfuscation for photo privacy — acceptable for MVP per the "no signed URLs" scope decision, but revisit if this assumption is challenged later.
- New JSON API convention (`/api/watches*`) diverges from the existing form-POST auth routes — intentional, scoped, and documented, but worth flagging so future contributors don't assume one universal API style.

## Success Criteria (Summary)

- A user can add a watch (with or without a photo) and see it appear in their collection grid immediately.
- A user can open a watch's detail page and see its photo, name, and add date.
- Data isolation holds: one user never sees another user's watches or photos.
