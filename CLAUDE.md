# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**GuardSync** ("Secure Shift Flow") is a shift-scheduling app for security staff (guards, dispatchers, facilities, posts), being rebuilt as a Next.js + Supabase app (`web/`), deployed on Vercel. **This is a pure stack migration — same features/UX, different stack — not a rewrite of behavior.** Full technical plan: `docs/MIGRATION_PLAN.md`.

The repo previously held a Base44-generated React/Vite frontend (`src/`) and Base44 platform config (`base44/`); both have been fully removed from this branch — see "Where the old app went" below if you need to reference the original behavior while porting a page. An earlier FastAPI/Postgres/Redis/Celery/Docker backend direction was also abandoned before anything was deployed; Next.js + Supabase + Vercel is the only target now.

## Commands

Everything lives in `web/`:
```powershell
cd web
npm install
npm run dev            # Next.js dev server, port 3000
npm run build           # production build
npm run lint             # eslint
npx tsc --noEmit          # type check
```
No Docker, no docker-compose — Supabase is a hosted Cloud project, not a local container (see `docs/MIGRATION_PLAN.md` §B.2 for why, and the local-dev-vs-hosted-project tradeoff). `web/supabase/migrations/` holds versioned SQL migrations, applied via `supabase db push` — see `docs/MIGRATION_PLAN.md` for the Supabase CLI setup.

## Where the old app went

The Base44-connected React/Vite app (`src/`, `base44/`, root `package.json`/`vite.config.js`/etc.) was deleted from this branch once the Next.js/Supabase migration was underway. It's **not gone from history** — reference it with:
```powershell
git show main:src/lib/routePermissions.js      # read a specific old file
git worktree add ../shift-seven-old main         # or check out a full old copy elsewhere
```
`main` and `develop` still have the full old app if you need to check exact original behavior (validation rules, field names, UI copy) while porting a page. `docs/MIGRATION_PLAN.md` and `architecture/DOMAIN_MODEL.md` document the domain model and business logic extracted from that source, which is usually enough — reach for git history only when you need exact original code.

## Architecture

- `web/` — Next.js (App Router, TypeScript strict). Data fetching is React Query + the Supabase JS client from Client Components (chosen to port the old app's component logic with minimal rewrite, not a Server-Components-first design). Authorization is enforced primarily via Postgres Row Level Security reading a custom JWT claim (`user_role`, projected from `staff.access_level` via a Supabase Auth Hook), not application code — see `docs/MIGRATION_PLAN.md` §B.2–B.3 for the full schema and policy design.
- `web/src/lib/supabase/client.ts` / `server.ts` — Supabase client factories (browser, server, service-role). Never use the service-role client outside trusted server code that does its own authorization checks.
- `web/src/proxy.ts` — session-refresh (Next.js 16 renamed `middleware.ts` → `proxy.ts`; the exported function is `proxy`, not `middleware`). **Next.js 16 has other breaking changes from what any given session might expect** — check `web/node_modules/next/dist/docs/` before writing new App Router code (routing, Server Actions, caching, etc.), per the warning Next.js's own tooling writes to `web/AGENTS.md`.
- `web/supabase/migrations/` — schema history. One migration so far: the full initial schema, `app_role` enum, `employee-request-attachments` Storage bucket, the `custom_access_token_hook` Auth Hook function, and RLS policies for every table + `storage.objects`.

Read `docs/MIGRATION_PLAN.md` before adding anything to `web/` — it has the full schema, RLS/RBAC design, background-job design (Vercel Cron, Slack, email), and the phase/ownership breakdown for the two devs working on this.

`docs/LLM_RULES.md` has rules for this stack (TypeScript-only, migrations as versioned SQL files, RLS required before a table is used from the frontend, no Dockerfiles, etc.).

## Domain model

Core entities (documented in `architecture/DOMAIN_MODEL.md`, implemented as Postgres tables in `web/supabase/migrations/`): `Staff`, `Facility`, `Post`, `ShiftTemplate`, `ShiftAssignment`, `ShiftRequest`, `EmployeeRequest`, `StaffingRequirement`, `SystemConfig`. Base44's separate `User` entity is gone — Supabase's built-in `auth.users` is the login identity, linked via `staff.user_id`; `staff.access_level` (a Postgres `app_role` enum) is the single authorization field, projected into the session JWT as a custom claim and read directly by RLS policies on both tables and Storage. Key relationships: `ShiftAssignment` links `Staff` + `ShiftTemplate` + `Post` + `Facility` for a given date; `ShiftTemplate` and `Post` belong to a `Facility`; `ShiftRequest`/`EmployeeRequest` belong to `Staff`. Concrete table definitions (types, constraints, RLS policies) live in `docs/MIGRATION_PLAN.md` §B.2–B.3, not `architecture/DOMAIN_MODEL.md` (which stays field-level/platform-agnostic).
