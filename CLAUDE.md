# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**GuardSync** ("Secure Shift Flow") is a shift-scheduling app for security staff (guards, posts, facilities). It's mid-migration: the live app is a Base44-hosted React SPA (`src/`); it's being rebuilt from scratch as a Next.js + Supabase app (`web/`, once scaffolded) with no Base44 dependency, deployed on Vercel. **This is a pure stack migration — same features/UX, different stack — not a rewrite of behavior.** Full technical plan: `docs/MIGRATION_PLAN.md`. An earlier FastAPI/Postgres/Redis/Celery/Docker direction was abandoned before anything was deployed; if you see references to it in old context, it's stale — Next.js + Supabase + Vercel is the only target now.

## Commands

Old Vite app (`src/`, stays running/buildable until cutover):
```powershell
npm install          # install deps
npm run dev           # vite dev server, port 5173
npm run build         # production build to ./dist
npm run lint           # eslint . --quiet
npm run lint:fix       # eslint . --fix
npm run typecheck     # tsc -p ./jsconfig.json (checkJs, not full TS — see jsconfig.json scope)
npm run preview       # preview a production build
```
There is no JS test runner configured for this app (no test script in package.json).

New Next.js app (`web/`) — commands will exist once Phase 0 scaffolding lands; expect standard `npm run dev`/`build`/`lint` plus `vitest` for unit tests, run from inside `web/`. No Docker, no docker-compose — Supabase is a hosted Cloud project, not a local container.

## Two apps during the migration — know which one you're touching

- **`src/`** — the live frontend. Talks directly to **Base44** via `@base44/sdk` (`src/api/base44Client.js`). Entities (`base44.entities.Staff`, `.ShiftAssignment`, etc.) and serverless functions (`base44.functions.invoke(...)`) are the current data/business-logic layer. Auth, sessions, and app settings are managed by Base44 (`src/lib/AuthContext.jsx`). Don't add new features here — it's being replaced, not extended.
- **`web/`** — the new Next.js (TypeScript) app being built against Supabase (Postgres + Auth + Storage), per `docs/MIGRATION_PLAN.md`. Data fetching is React Query + the Supabase JS client from Client Components (chosen to port existing component logic with minimal rewrite, not a Server-Components-first design). Authorization is enforced primarily via Postgres Row Level Security, not application code.
- **`base44/`** — Base44 platform config: entity schemas (`base44/entities/*.jsonc`), serverless functions (`base44/functions/*/entry.ts`), workflows, and connectors (e.g. Slack). Source of truth for the domain model and business logic that `docs/MIGRATION_PLAN.md`'s Supabase schema/Route Handlers must replicate — see `architecture/DOMAIN_MODEL.md`.

Read `architecture/CURRENT_ARCHITECTURE.md` before touching `src/` auth or data-fetching — it documents the current Base44-coupled flow (still accurate until cutover). Read `architecture/ARCHITECTURE_RECOMMENDED.md` and `docs/MIGRATION_PLAN.md` before adding to `web/` — the plan has the full schema, RLS policy design, and phase/ownership breakdown.

`docs/LLM_RULES.md` has rules for the new stack (TypeScript-only, migrations as versioned SQL files, RLS required before a table is used from the frontend, no Dockerfiles, etc.) — follow these when working in `web/`.

## Old app architecture (`src/`, reference only — being replaced)

- `src/main.jsx` boots React; `src/App.jsx` owns routing (`react-router-dom`) and top-level providers: `AuthProvider` → `QueryClientProvider` (React Query, `src/lib/query-client.js`) → `Router` → `ImpersonationProvider`.
- **Auth**: `src/lib/AuthContext.jsx` checks Base44 app public settings, then `base44.auth.me()`. Auth errors surface as `authError.type` (`auth_required`, `user_not_registered`) and are handled in `App.jsx`.
- **Access control**: `src/lib/routePermissions.js` (`ROUTE_ACCESS`) is the single source of truth mapping route paths to allowed `access_level` tiers (`admin`, `scheduler`, `employee`, `no_access`). Both the sidebar nav (`Layout.jsx`) and the route guard (`src/components/RequireAccess.jsx`) read this map — update it, not the individual components, when changing what a role can reach.
- **Impersonation**: `src/lib/ImpersonationContext.jsx` lets an admin view the app as another staff member (persisted in `localStorage` under `ss_impersonation_staff_id`). `effectiveStaff` / `effectiveAccessLevel` are the impersonation-aware values components should read instead of the raw authenticated user — most role-gated UI should consume this context, not `useAuth()` directly.
- **Path alias**: `@/*` → `src/*` (see `jsconfig.json` and `components.json`). `components.json` is a shadcn/ui config — `src/components/ui/*` are generated shadcn primitives (style "new-york"); prefer regenerating/extending via shadcn conventions over hand-rolling new primitives.
- `jsconfig.json` scopes type-checking to `src/components/**`, `src/pages/**`, and `Layout.jsx`, and explicitly excludes `src/components/ui`, `src/api`, `src/lib`. `eslint.config.js` mirrors this scoping (same include/exclude), so lint/typecheck signal is strongest in components/pages and intentionally silent elsewhere.
- Pages under `src/pages/` map 1:1 to routes registered in `App.jsx`; feature-specific sub-components live in matching folders under `src/components/` (e.g. `SmartSchedule/`, `employee/`).

## Domain model

Core entities (defined in `base44/entities/*.jsonc`, mirrored in `architecture/DOMAIN_MODEL.md`): `Staff`, `Facility`, `Post`, `ShiftTemplate`, `ShiftAssignment`, `ShiftRequest`, `EmployeeRequest`, `StaffingRequirement`, `SystemConfig`. (Base44's separate `User` entity is gone in the new schema — Supabase's built-in `auth.users` is the login identity, linked via `staff.user_id`; `staff.access_level` alone drives authorization now, see `docs/MIGRATION_PLAN.md` §B.2–B.3.) Key relationships: `ShiftAssignment` links `Staff` + `ShiftTemplate` + `Post` + `Facility` for a given date; `ShiftTemplate` and `Post` belong to a `Facility`; `ShiftRequest`/`EmployeeRequest` belong to `Staff`. The concrete Postgres/Supabase table definitions (types, constraints, RLS policies) live in `docs/MIGRATION_PLAN.md` §B.2–B.3, not `architecture/DOMAIN_MODEL.md` (which stays field-level/platform-agnostic).
