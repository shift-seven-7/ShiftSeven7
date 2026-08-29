# SaaS Infra

A generic multi-tenant SaaS foundation. **There is no domain here** — what
exists serves any project. A domain feature enters as a **module**, never as a
change to the core.

Documentation is English. The application UI is Hebrew, so Hebrew appears in
code and in docs only as actual UI strings.

## Stack
- **Framework:** Next.js 16 (App Router), TypeScript strict
- **DB + Auth:** Supabase — one project per tenant, plus a master registry project
- **Data fetching:** TanStack Query v5, every hook in `hooks/queries/`
- **Styling:** Tailwind v3, dark-first, tokens in `app/globals.css`, Heebo font
- **Components:** shadcn/ui (new-york) in `components/ui/`

## Architecture: client-first (CSR only)
- Every page is `'use client'` — no SSR, no SEO
- Every DB/auth operation goes through `app/api/*`
- The frontend **never touches Supabase directly**, except the session listener

## Language
- All UI text is **Hebrew**
- All layout uses **logical RTL properties**: `ms-`, `me-`, `ps-`, `pe-`,
  `text-start`, `start-0`

---

## The tenant model

```
Host: acme.example.app
  → proxy.ts             extracts "acme" from the Host header
  → master registry      the tenants table: where acme lives
  → AES-GCM decrypt      of the anon key
  → headers              x-tenant-id · x-tenant-subdomain · x-supabase-url · x-supabase-anon-key
  → session refresh      against acme's own project
App → /api/* → lib/supabase/{server,service}.ts → acme's database only
```

**Physical isolation, not cross-tenant RLS.** Auth users live in each tenant's
own project — the same person on two tenants is two accounts.

### Two databases
| | master | tenant |
|---|---|---|
| How many | one | one per customer |
| Contents | the `tenants` table only | `users`, `system_settings`, `tenant_feature_defaults`, `files`, `terms_acceptances` + module tables |
| Migrations | `master_migrations/` | `supabase/migrations/` |
| Apply with | `npm run db:migrate:master` (local) · `npm run sync-master-migrations` (hosted) | `npm run db:migrate` (local) · `npm run sync-tenant-migrations` (hosted) |

### The five Supabase clients (`lib/supabase/`)
| File | Target | When to use it |
|---|---|---|
| `server.ts` | tenant, as the user | **the default** for every API route |
| `service.ts` | tenant, service role | only when RLS genuinely cannot express it |
| `master-client.ts` | the master | registry reads and writes |
| `client.ts` | browser | session listener and OAuth only |
| `tenant/cache.ts` | — | caches connection details only, 5-minute TTL |

---

## Rules that do not bend

1. **Migrations are files.** Never run SQL against a live database without an
   explicit request from the developer.
2. **A service-role key never leaves the server.** Every response under
   `app/api/admin/tenants/**` is typed `TenantPublic`, so returning a raw
   `Tenant` is a compile error.
3. **The subdomain is immutable** after creation — the encryption AAD, the DNS
   records and the OAuth redirect URLs are all bound to it.
4. **No `Record<string, unknown>` in a Supabase write** — use the types in
   `types/database.types.ts`.
5. **Row types are `type`, not `interface`.** Supabase constrains `Row` to
   `Record<string, unknown>`, and TypeScript grants an implicit index signature
   to a type alias but never to an interface. An interface turns every query
   into `never`.
6. **Server-only modules are enforced by eslint, not `server-only`.** The rule
   in `eslint.config.mjs` covers `lib/crypto`, `lib/services`,
   `lib/supabase/{master-client,service}` and `lib/constants/migrations`.
   `server-only` is deliberately not used: several of those modules are also
   imported by the CLI scripts, where it would throw.
7. **UI guards are not security.** Every route checks its own role, and RLS
   backs it up.

---

## Working method

For every feature task, **in order**, unless the request starts with `quick:`:

1. **dev-read-context** — read `docs/INDEX.md` and the relevant feature docs
2. **dev-plan** — plan and get the developer's approval before writing code
3. **dev-implement** — implement, following every coding skill
4. **dev-verify** — review the changed files against the plan
5. **dev-security** — check auth, RLS, OWASP
6. **dev-report-issues** — record unrelated bugs in `docs/issues/`
7. **dev-update-docs** — update `docs/features/`

### Quick mode
`quick:` for small changes (styling, copy, a targeted fix) — skips the seven
steps but still honours the coding skills. **Not** for a new feature, a
migration, an API change, or a refactor.

---

## Adding a module (5 edit points)

| # | File | What you add |
|---|---|---|
| 1-3 | `lib/constants/features.ts` | a key in `FEATURE_KEYS` · a descriptor in `getFeatureFlags()` · a `ROUTE_FEATURES` entry |
| 4 | `components/layout/Sidebar.tsx` | a nav item carrying `feature:` |
| 5 | `lib/constants/permissions.ts` | a `ROUTE_PERMISSIONS` entry for the route |

Then `app/app/<module>/`, `app/api/<module>/`, and a migration for its tables.
Details: the `modules` skill.

## Adding a role (4 files)

`types/roles.ts` → `lib/constants/roles.ts` → `lib/constants/permissions.ts` →
a migration widening `users_app_role_check`. The two middle maps are declared as
total `Record<UserRole, …>`, so the build breaks until they are filled in.
Details: the `roles-permissions` skill.

---

## Local development

`npm run db:init` takes a clone to a working environment: it applies both
migration sets and seeds three demo tenants (`local`, `acme`, `beta`), reachable
at `<subdomain>.localhost:3000`.

Tenant resolution goes through the registry locally too, exactly as in
production — so without `db:migrate:master` there is no `tenants` table and
every request lands on `/tenant-not-found`. All three demo tenants share one
local database, so routing and encryption are real but data isolation is not.

Full guide: `docs/getting-started.md`.

---

## Documentation
- `docs/INDEX.md` — the map + Page Map (route → docs)
- `docs/getting-started.md` — local setup and tenant simulation
- `docs/deployment.md` — accounts, domain, Frankfurt, the first tenant
- `docs/architecture.md` — stack, data model, permissions, storage
- `docs/multi-tenant.md` — tenant resolution, the Supabase clients, encryption
- `docs/modules-and-roles.md` — the full add-a-module and add-a-role recipes
- `docs/migrations.md` — the multi-tenant migration workflow
- `docs/features/` — one doc per feature
- `docs/issues/` — bugs found and not fixed

## Skills
- **design-system** — tokens, RTL, mobile-first, Hebrew copy rules
- **form-dialogs** — `FormField`, live validation, sticky footer, RTL primitives
- **confirmation-dialogs** — AlertDialog vs Dialog, RTL footer reversal
- **data-table-pages** — filter bar, CSS-grid table, pagination
- **code-standards** — TypeScript, component structure, API routes, accessibility
- **code-reuse** — check what exists before writing anything new
- **tanstack-query** — hooks, `keys.ts`, fetching through `/api/*`
- **multi-tenant** — tenant resolution, the five clients, encrypted-credential rules
- **modules** — the add-a-module recipe
- **roles-permissions** — the add-a-role recipe
- **tenant-provisioning** — automated vs manual, the eight setup steps
- **migrations** — idempotent migrations, syncing across tenants
- **dev-\*** — the seven workflow steps
