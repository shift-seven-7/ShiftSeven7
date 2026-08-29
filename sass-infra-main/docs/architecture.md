# Architecture

## What this is

A multi-tenant SaaS foundation. It carries no domain concepts — a project built
on it adds those as modules. What it does carry: tenancy, onboarding, auth,
roles, module gating, a design system, and an admin console.

## Stack

| Layer | Choice | Note |
|---|---|---|
| Framework | Next.js 16, App Router | middleware is `proxy.ts` under the new naming |
| Language | TypeScript, `strict` | |
| Database | Supabase Postgres | one project per tenant, plus a master registry |
| Auth | Supabase Auth | per tenant — no cross-tenant identity |
| Data fetching | TanStack Query v5 | every hook in `hooks/queries/` |
| Styling | Tailwind v3 | tokens in `app/globals.css` |
| Components | shadcn/ui (new-york) | plus custom RTL primitives |
| Font | Heebo via `next/font` | exposed as `--font-sans` |
| Hosting | Vercel | wildcard domain + per-tenant CNAME |

## Client-first

Every page is `'use client'`. No SSR, no SEO — this is an authenticated
application. Server code exists only in `app/api/*`, `proxy.ts`, and the
provider wrappers that read request headers.

Consequence: the browser never holds Supabase credentials beyond the tenant's
publishable key, and every data path is an API route that can enforce
authorization.

## The two databases

```
                      ┌───────────────────────────┐
                      │  MASTER (one project)     │
                      │  public.tenants           │
                      │   · subdomain → URL + keys│
                      │   · settings (JSONB)      │
                      │   · setup_status (JSONB)  │
                      └───────────┬───────────────┘
                                  │ resolve
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌──────────────┐         ┌──────────────┐          ┌──────────────┐
│ TENANT acme  │         │ TENANT beta  │          │ TENANT gamma │
│ auth.users   │         │ auth.users   │          │ auth.users   │
│ public.users │         │ public.users │          │ public.users │
│ … modules    │         │ … modules    │          │ … modules    │
└──────────────┘         └──────────────┘          └──────────────┘
```

Isolation is physical. There is no `tenant_id` column anywhere in the tenant
schema, because two tenants never share a database. A query cannot leak across
tenants, because it cannot reach another tenant's database at all.

The trade-off: schema changes must be applied N times. `sync-tenant-migrations`
does that, and `_applied_migrations` per tenant keeps them convergent.

## Tenant baseline schema

| Table | Purpose |
|---|---|
| `users` | profile + `app_role` per `auth.users` row |
| `system_settings` | tenant-scoped key/value config |
| `tenant_feature_defaults` | tenant-wide module on/off within the package |
| `files` | upload registry over Supabase Storage |
| `terms_acceptances` | who accepted which legal version |
| `_applied_migrations` | migration tracking |

Two RLS helpers, `public.current_app_role()` and `public.is_admin()`, are the
only place a role list appears in SQL. Every policy goes through them.

## Auth

Users belong to a tenant's own Supabase project. The same person on two tenants
is two accounts.

Which methods a deployment offers is `NEXT_PUBLIC_AUTH_METHODS`, resolved
through a registry rather than hard-coded — see `docs/features/auth-methods.md`.

```
/auth/login ─ POST /api/auth/<method>/start ─┬─► session ───────────────┐
                                             ├─► redirect ─► provider ──┤
                                             └─► pending_verification   │
                                                   └► .../verify ───────┤
                                                                        │
                                                          /auth/callback (oauth)
                                                                        │
                                                    exchangeCodeForSession
                                                                        │
                                              upsert public.users (app_role: null)
                                                                        │
                                         HOME_PAGES[role] or /app/pending-approval
```

Identity is either-or: `users.email` is nullable and `phone` is unique, with a
check that at least one is present. A phone-OTP deployment produces accounts
that never had an email address, so requiring one would bake a single sign-in
method into the schema.

`app_role IS NULL` means "signed up, awaiting approval" — the normal state for a
self-registration. An admin assigns a role from `/app/users`.

The proxy refreshes the session on every request and redirects anonymous
traffic. API routes re-verify independently.

## Roles

Two, fixed in code: `ADMIN` and `SYSTEM_MANAGER`. `types/roles.ts` is the source
of truth; `lib/constants/roles.ts` and `lib/constants/permissions.ts` describe
them in total `Record<UserRole, …>` maps, so adding one breaks the build until it
is fully described.

Authorization is enforced in the API route (`requireRoles`) and in RLS. The
client-side route guard and nav filter exist so users do not land on pages that
would fail — they are UX, not security.

**Platform operator is not a role, and not a tenant user.** Managing the
platform through a tenant's account was always awkward — `ADMIN` is a role every
customer's own administrator holds, and the console was only reachable from
inside somebody's tenant. So operators have their own identity: `/backoffice`
authenticates against the **master** project with Google, which is why it works
on the apex where no tenant resolves.

Authorization there is `PLATFORM_OPERATOR_EMAILS` and nothing else — the master
project has no user table and no roles — so an empty list admits nobody.
`requireOperatorAccess` in `lib/auth/platform.ts` accepts that master session or,
failing it, the tenant session the older console still uses.

## Modules

Feature flags, resolved in three layers and merged in `/api/users/me`:

```
tenants.settings.features   ∩   tenant_feature_defaults   ∩   users.features_override
   (master: bought)              (tenant: switched on)        (per user: opted out)
```

Absent layer 1 means "everything" — that is what lets a new module reach
existing tenants without a data migration. Super roles bypass layers 2 and 3.

The registry ships empty. See `modules-and-roles.md`.

## Storage

| Bucket | Public | Limit | Holds |
|---|---|---|---|
| `avatars` | yes | 10 MB | profile pictures, tenant logos |
| `media` | yes | 50 MB | general media |
| `documents` | no | 50 MB | anything not world-readable |

Uploads go through `POST /api/files/upload` as the signed-in user, so Storage
policies apply on top of the size and MIME checks. Objects are indexed in
`public.files`; a failed index insert removes the object so nothing is orphaned.

Buckets are created on each new tenant project by setup step 3, which reads the
same `lib/storage/config.ts` — one definition, two consumers.

## Design system

Tokens live in `app/globals.css` as bare HSL triplets, consumed as
`hsl(var(--x))`. `tailwind.config.ts` only maps them onto utilities.

- Dark is `:root`; light is the `.light` override
- `next-themes` for mode, plus a runtime color-preset system in
  `lib/theme/colors.ts` that rewrites `--primary` and friends inline
- Per-user choice persists to `users.theme_mode` / `theme_color`
- RTL is fixed: `<html lang="he" dir="rtl">`, logical properties only

Never hardcode a color in a component.

## Environment

See `.env.example`. The ones that matter:

| Variable | Without it |
|---|---|
| `MASTER_SUPABASE_URL` / `_SERVICE_KEY` | no tenant resolves |
| `TENANT_SECRETS_KEY` | stored credentials cannot be opened (checked by `/api/health`) |
| `NEXT_PUBLIC_AUTH_METHODS` | defaults to `password` |
| `PLATFORM_OPERATOR_EMAILS` | `/backoffice` admits nobody; every tenant ADMIN reaches the in-tenant console |
| `MASTER_SUPABASE_ANON_KEY` | `/backoffice` cannot sign anyone in |
| `NEXT_PUBLIC_BASE_DOMAIN` | subdomain routing falls back to localhost |
| `SUPABASE_MANAGEMENT_TOKEN` / `SUPABASE_ORG_ID` | automated provisioning unavailable |
| `VERCEL_TOKEN` / `VERCEL_DNS_TARGET` | DNS step skips itself |
| `DEFAULT_PREVIEW_TENANT` | previews land on `/tenant-not-found` (the safe default) |

## Deliberate choices

**Physical isolation over RLS-based tenancy.** More operational work, but a
cross-tenant leak requires a wrong connection string rather than a wrong `WHERE`
clause.

**Four request headers, not fourteen.** Mutable configuration is read from the
registry per request. Keeps admin changes immediate and headers small.

**Encryption at rest for tenant keys.** Protects a database dump. The anon key
still reaches the browser by design; the service-role key never leaves the
server, and `TenantPublic` makes that a compile-time guarantee. Anything else
credential-shaped goes in the `tenants.secrets` bag, sealed the same way —
`settings` is plaintext and must stay non-secret.

**Roles in code, not in a table.** Two roles, changed by deploy. A DB-driven
role system is more flexible and more machinery than a foundation needs — the
four-file recipe keeps the cost of adding one low.
