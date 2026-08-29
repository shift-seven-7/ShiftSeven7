# ניהול טננטים (Tenant admin)

## Overview

The registry console: list tenants, register or provision one, edit its details,
and configure what it gets.

Two entry points to the same registry:

| Route | Identity | Works without a tenant |
|---|---|---|
| `/backoffice` | the **master** project's auth, Google only | yes — this is the point |
| `/app/admin/tenants` | a tenant's auth + the `ADMIN` role | no |

`/backoffice` is the operator's front door: it runs on the apex domain, needs no
account inside any customer's database, and carries the tenant list plus
provisioning. The in-tenant console keeps everything scoped to one tenant — its
settings, logo, module matrix and setup wizard — and the backoffice links into
it per tenant.

Both call the same `/api/admin/tenants/**` endpoints, which accept either
session through `requireOperatorAccess()`.

## User Roles & Access

Two gates, both required:

1. **Role** — `TENANT_ADMIN_ROLES` in `lib/constants/roles.ts` (`ADMIN` by
   default). Widening access is a one-line change there.
2. **Platform operator** — the caller's address must be in
   `PLATFORM_OPERATOR_EMAILS`. `requireOperatorAccess` in `lib/auth/platform.ts`
   enforces it on all five `/api/admin/tenants/**` routes; `/api/users/me`
   reports `isPlatformOperator` so the sidebar hides the entry and the route
   guard redirects.

**The allow-list is strict at `/backoffice` and lenient in the tenant console.**
The master project has no roles and no user table, so there the list is the only
authorization and an empty one admits nobody. The in-tenant console already
requires an approved `ADMIN` inside a real tenant, so an empty list degrades to
that role alone — the pre-existing behaviour.

**Why two.** `ADMIN` is a role every customer's own administrator holds. On the
role alone, any of them could list every tenant, edit their records, and
provision Supabase projects on the operator's account. Tenant-level admin and
platform-level operator are different jobs.

Everything the in-tenant console touches sits under one prefix,
`PLATFORM_ROUTE_PREFIX` (`/app/admin`). `/backoffice` and `/api/backoffice` skip
tenant resolution entirely in `proxy.ts`, which is what lets them answer on a
host with no tenant.

## Pages & Routes

| Route | Purpose |
|---|---|
| `/backoffice` | operator sign-in (Google, master project), tenant list, provisioning |
| `/backoffice/callback` | the OAuth code exchange for the above |
| `/app/admin/tenants` | list: name, subdomain, plan, status, setup progress |
| `/app/admin/tenants/new` | register a Supabase project you created by hand |
| `/app/admin/tenants/new-automated` | provision a project end to end |
| `/app/admin/tenants/[id]` | three tabs (below) |
| `/app/admin/tenants/[id]/setup` | the eight-step wizard, one step at a time |

### The three tabs

| Tab | Configures |
|---|---|
| פרטי טננט | name, plan, limits, status, Supabase connection |
| הגדרות לקוח | logo, module toggle matrix |
| תנאי שימוש | terms of service, privacy policy |

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/admin/tenants` | GET | list — no key columns are selected |
| `/api/admin/tenants` | POST | manual registration |
| `/api/admin/tenants/[id]` | GET | one tenant, as `TenantPublic` |
| `/api/admin/tenants/[id]` | PATCH | details, or `action: suspend \| reactivate` |
| `/api/admin/tenants/[id]` | DELETE | soft delete — status becomes `deleted` |
| `/api/admin/tenants/create-automated` | POST | full provisioning; 207 on partial |
| `/api/admin/tenants/[id]/setup` | GET | per-step progress |
| `/api/admin/tenants/[id]/setup/run-step` | POST | re-run one step |
| `/api/tenant/settings` | GET / PATCH | the current tenant's settings |
| `/api/backoffice/session` | GET / POST / DELETE | operator session: who am I, start Google, sign out |

Everything under `/api/admin/tenants` accepts **either** an allow-listed master
session or a tenant `ADMIN` session, so both consoles share one implementation.

## Data Model

`public.tenants` in the **master** database. See
`master_migrations/20260101000000_master_baseline.sql`.

`settings` (JSONB): `logo_url`, `primary_color`, `custom_domain`, `features[]`,
`terms_of_service`, `privacy_policy`, `terms_version`.

`setup_status` (JSONB): `{ steps, admin_email, last_error, updated_at }`.

## Key Files

| File | Role |
|---|---|
| `components/admin/TenantDetailsTab.tsx` | identity, plan, connection |
| `components/admin/TenantSettingsTab.tsx` | logo + module matrix |
| `components/admin/TermsSettingsTab.tsx` | legal copy |
| `lib/tenant/serialize.ts` | `toTenantPublic` — the key-leak guard |
| `lib/supabase/master-client.ts` | registry CRUD and the encryption boundary |
| `lib/supabase/master-auth.ts` | the operator's session against the master project |
| `lib/auth/platform.ts` | `requireOperatorAccess` — the dual-session guard |
| `components/admin/ProvisionTenantForm.tsx` | the provisioning form, shared with `/bootstrap` |

## Design notes

**Why keys are write-only.** The server never sends a key back, so the fields
render empty and an empty submission means "leave the stored key alone". There
is no reveal or copy affordance because the browser genuinely does not have the
value. `TenantPublic` sends `supabase_anon_key_masked` and
`has_service_role_key` instead.

**Why the subdomain is disabled.** The encryption AAD is bound to it, and so are
the DNS record and the OAuth redirect URLs. Changing it would invalidate both
stored keys. The PATCH handler rejects it too.

**Why the module matrix is binary.** On or off. A three-state variant with a
"teaser" tier is roughly forty lines — one extra settings array, one predicate
in `usePermissions`, one overlay component — if a project wants upsell prompts.

**Why an absent `features` array means "everything".** A tenant with no explicit
package keeps receiving newly added modules. The matrix says so in its
description, and the first toggle converts the tenant to an explicit package.

**Why saving legal copy re-stamps `terms_version`.** That is what makes existing
users re-accept. Edit the text only when you mean that.

## Related

- [provisioning.md](../provisioning.md) — the two onboarding paths, the eight steps
- [multi-tenant.md](../multi-tenant.md) — encryption, caching, the `TenantPublic` guard
- [modules-and-roles.md](../modules-and-roles.md) — what the matrix toggles
