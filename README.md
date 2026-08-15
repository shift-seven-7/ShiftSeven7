# ShiftSeven7 (GuardSync)

Shift-scheduling app for security staff (guards, dispatchers, facilities, posts).

**Stack:** Next.js (TypeScript, App Router) + Supabase (Postgres, Auth, Storage), deployed on Vercel.

The app lives entirely in [`web/`](web/) — see [`web/README.md`](web/README.md) for local setup, and [`docs/MIGRATION_PLAN.md`](docs/MIGRATION_PLAN.md) for the full architecture (schema, RLS/role-based access, background jobs, build phases).

This repo previously hosted a Base44-generated React/Vite frontend; that app and the Base44 platform config have been fully replaced by `web/`.

## Quick start

```bash
cd web
npm install
cp .env.local.example .env.local   # fill in from your Supabase project's Settings > API
npm run dev
```

## Docs

- [`CLAUDE.md`](CLAUDE.md) — guidance for AI coding agents working in this repo
- [`docs/MIGRATION_PLAN.md`](docs/MIGRATION_PLAN.md) — schema, RLS/RBAC design, background jobs, build phases
- [`docs/LLM_RULES.md`](docs/LLM_RULES.md) — rules for LLM-generated changes
- [`architecture/`](architecture/) — architecture docs and diagrams
