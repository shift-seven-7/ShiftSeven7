# sass-infra

**English** · [עברית](README.he.md)

A generic multi-tenant SaaS foundation — Next.js + Vercel + Supabase, Hebrew RTL.

This is the starting point for a new SaaS project. It contains **infrastructure
only**: multi-tenancy, tenant onboarding, an admin console, permissions, modules
and a design system. There are no domain concepts in it — those get added as
modules.

> The application UI is Hebrew. Documentation is English; Hebrew appears only
> where a doc quotes an actual UI string, so you can find it on screen.

## What's here

| Layer | Description |
|---|---|
| **Multi-tenancy** | Subdomain → master registry lookup → a separate Supabase project per tenant (DB + Auth + Storage). Physical isolation. |
| **Tenant onboarding** | Automated (Supabase Management API + Vercel DNS + first admin user) or manual registration of an existing project. |
| **Admin console** | `/app/admin/tenants` — list, create, an eight-step setup wizard, client settings (logo, modules, terms of service). |
| **Permissions** | Roles fixed in code. Ships with `ADMIN` + `SYSTEM_MANAGER`. |
| **Modules** | Binary feature flags per tenant. The registry ships empty. |
| **Design system** | Dark-first HSL token system, logical RTL, shadcn/ui plus custom primitives. |

## Prerequisites

What has to be on the machine before anything will run.

| Tool | Version | Why |
|---|---|---|
| **Node.js** | 20.9+ (24 LTS recommended) | Next.js 16 will not start below 20.9 |
| **npm** | 10+ | ships with Node |
| **Docker Desktop** | any supported version | local Supabase is a stack of containers. Must be **running** before `npm run db:start` |
| **Supabase CLI** | 2.x | starts and manages the local database. **Not a project dependency** — install it separately |
| **Git** | any | |

### Install — macOS

```bash
# Node (via nvm; honours the .nvmrc in this repo)
brew install nvm && nvm install && nvm use

# Docker Desktop
brew install --cask docker      # then open the app once

# Supabase CLI
brew install supabase/tap/supabase
```

### Install — Windows / Linux

- **Node:** [nodejs.org](https://nodejs.org) or `nvm-windows`
- **Docker:** Docker Desktop (Windows) or Docker Engine (Linux)
- **Supabase CLI:** see [supabase.com/docs/guides/local-development](https://supabase.com/docs/guides/local-development)
  — packages exist for Scoop, apt and npm

### Verify

```bash
node -v        # v20.9.0 or higher
docker info    # must print output, not a connection error
supabase -v    # 2.x
```

A failing `docker info` means Docker Desktop is not running. That is the single
most common reason `npm run db:start` hangs.

### What you do **not** need

- **No Supabase account to develop.** The local stack acts as both the master
  registry and the only tenant. A cloud account is needed only to onboard real
  tenants.
- **No `SUPABASE_MANAGEMENT_TOKEN` or `VERCEL_TOKEN`** — those drive automated
  tenant provisioning. Without them that one path is off and everything else
  works.
- **No local Postgres.** The CLI runs it inside Docker.

---

## Quick start

```bash
npm install
cp .env.example .env.local

# Encryption key for the tenant credentials — required, or every registry
# write fails.
npm run secrets:generate-key      # copy into TENANT_SECRETS_KEY in .env.local

# Local Supabase. The first run pulls Docker images (a few minutes).
npm run db:start
npm run db:status                 # copy API_URL / ANON_KEY / SERVICE_ROLE_KEY
```

Those three values go into `.env.local`:

```
LOCAL_TENANT_SUBDOMAIN=local
LOCAL_TENANT_SUPABASE_URL=<API_URL>
LOCAL_TENANT_SUPABASE_ANON_KEY=<ANON_KEY>
LOCAL_TENANT_SUPABASE_SERVICE_KEY=<SERVICE_ROLE_KEY>
```

Then:

```bash
npm run db:init                   # tenant + master migrations, 3 demo tenants
npm run dev
```

Open **`http://local.localhost:3000`**.

> `db:init` includes `db:migrate:master`, which creates the `tenants` table.
> Without it no address resolves and everything lands on `/tenant-not-found` —
> the app resolves tenants through the registry locally too, exactly as it does
> in production.

### Switching tenants locally

| Address | Tenant |
|---|---|
| `local.localhost:3000` | the default |
| `acme.localhost:3000` | a second tenant |
| `beta.localhost:3000` | a third |
| `nosuch.localhost:3000` | `/tenant-not-found` |

All three share one local database — routing and encryption are real, data
isolation is not.

**Full walkthrough:** [docs/getting-started.md](docs/getting-started.md) — first
signup, promoting yourself to ADMIN, a tour of the console, creating a tenant.

**Going live:** [docs/deployment.md](docs/deployment.md) — accounts, domain,
Frankfurt, and the first tenant.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | dev server against local Supabase |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:init` | clone → working environment: start → migrate → migrate:master → seed |
| `npm run db:start` / `db:stop` | start and stop the local Docker stack |
| `npm run db:status` | URLs and keys for the local stack |
| `npm run db:migrate` | tenant migrations against the local DB |
| `npm run db:migrate:master` | master migrations (the `tenants` table) against the local DB |
| `npm run db:seed` | demo tenants (`-- --reset` to recreate them) |
| `npm run db:reset` | wipe the local DB, re-run every migration, re-seed |
| `npm run tenant:bootstrap` | provision a tenant from the CLI — this is how the first one is made |
| `npm run sync-master-migrations` | apply `master_migrations/` to the hosted master |
| `npm run sync-tenant-migrations` | apply `supabase/migrations/` to every active tenant (`-- --tenant=x` for one) |
| `npm run secrets:generate-key` | mint a new `TENANT_SECRETS_KEY` |
| `npm run secrets:encrypt` | encrypt credentials still stored as plaintext |
| `npm run secrets:rotate` | rotate `TENANT_SECRETS_KEY` |

## Local ports

| Port | What |
|---|---|
| 3000 | Next.js |
| 54321 | Supabase API — this is what goes into `LOCAL_TENANT_SUPABASE_URL` |
| 54322 | Postgres |
| 54323 | Supabase Studio |
| 54324 | Mailpit — where confirmation and reset emails land in development |

## Common problems

| Symptom | Cause |
|---|---|
| `npm run db:start` hangs or fails | Docker Desktop is not running. Check `docker info` |
| `supabase: command not found` | the CLI is not installed — see Prerequisites |
| **Everything lands on `/tenant-not-found`** | `npm run db:init` was never run, or `LOCAL_TENANT_SUPABASE_*` are empty. The proxy prints an explicit warning in the terminal |
| `Cannot read public.tenants` | missing `npm run db:migrate:master` |
| `TENANT_SECRETS_KEY is not set` | run `npm run secrets:generate-key` and add it to `.env.local` |
| No confirmation email | email confirmation is off locally, so signup is immediate. If you enabled it, mail lands at `http://127.0.0.1:54324` |
| Stuck on "ממתין לאישור" (pending approval) | Working as intended. Promote yourself to `ADMIN` — see [getting-started](docs/getting-started.md) |

## Where to start reading

- `.claude/CLAUDE.md` — the architecture and the working method
- `docs/architecture.md` — stack, data model, permission model
- `docs/multi-tenant.md` — tenant resolution, the five Supabase clients, encryption
- `docs/modules-and-roles.md` — how to add a module and how to add a role

## Rules that do not bend

1. Every page is `'use client'`. No SSR, no SEO.
2. The frontend never touches Supabase directly — everything goes through
   `/api/*` and TanStack Query.
3. All UI text is Hebrew; all layout uses logical RTL properties (`ms-`, `me-`,
   `ps-`, `pe-`, `text-start`).
4. Migrations are **files only**. Nobody runs SQL against a live database
   without being asked.
5. A tenant's service-role key never leaves the server. Ever.
