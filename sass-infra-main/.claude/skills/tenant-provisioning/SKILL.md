---
name: tenant-provisioning
description: How a new tenant is created — the automated path vs manual registration, the eight setup steps, and why each one is re-runnable. Always use when touching lib/services/tenant-*.ts, supabase-management.ts, vercel-api.ts, or the setup wizard.
---

# Tenant provisioning

Two paths to a working tenant. Both end with a row in the registry.

| | Automated | Manual |
|---|---|---|
| Route | `POST /api/admin/tenants/create-automated` | `POST /api/admin/tenants` |
| UI | `/app/admin/tenants/new-automated` | `/app/admin/tenants/new` |
| Creates the Supabase project | yes | no — you already did |
| Needs | `SUPABASE_MANAGEMENT_TOKEN`, `SUPABASE_ORG_ID` | nothing extra |
| When | the org has a free project slot | it does not, or the project exists |

The automated path also accepts `existingProjectRef`, which adopts a project you
made by hand and runs the remaining seven steps against it. That is the bridge
between the two paths — not a dead end.

## The eight steps

`lib/services/tenant-setup-steps.ts`, run in order by
`lib/services/tenant-automation.ts`.

| # | Step | Does |
|---|---|---|
| 1 | `project_created` | cost check → create project → poll until `ACTIVE_HEALTHY` |
| 2 | `migrations_applied` | replays every file in `supabase/migrations/` |
| 3 | `buckets_created` | creates the missing buckets from `lib/storage/config.ts` |
| 4 | `auth_configured` | site URL, redirect allow-list, Google provider |
| 5 | `credentials_saved` | reads the project's keys |
| 6 | `tenant_registered` | writes the registry row, sealing both keys |
| 7 | `domain_added` | CNAME on the base domain via Vercel |
| 8 | `admin_created` | first ADMIN user on the tenant project |

## Why steps, not one function

Provisioning touches three external systems and any of them can fail
transiently. Step 1 creates a real, billable project — restarting from scratch
after a failure at step 6 means leaking a project.

So: progress is recorded per step on `tenants.setup_status`, and every step is
**idempotent**. The wizard at `/app/admin/tenants/[id]/setup` re-runs any single
step. Fix the cause, retry that step, move on.

### What idempotent means per step

- **1** — skips entirely if `projectRef` is already known
- **2** — migrations are individually idempotent, so replaying all of them onto
  a partially migrated project is safe (and simpler than tracking which landed)
- **3** — lists existing buckets first, creates only what is missing
- **4, 5** — pure writes/reads, naturally repeatable
- **6** — returns early if the tenant row exists
- **7** — checks for an existing DNS record before adding
- **8** — returns early if a user with that email already exists

**If you add a step, it must be idempotent.** That is the contract.

## The cost gate

Step 1 calls `getProjectCost()` and refuses to proceed if it is non-zero:

> יצירת פרויקט נוסף בארגון כרוכה בתשלום. צור את הפרויקט ידנית…

This is intentional. An agent or a mis-click should not silently add a paid
project to someone's Supabase org. The operator either frees a slot or uses the
manual path.

## Rollback rules

Nothing is rolled back at the orchestration level — a half-provisioned tenant is
a resumable state, not garbage.

Inside a step, rollback applies where a partial write would be unrecoverable:

- **Step 8**: if the profile insert fails after the auth user was created, the
  auth user is deleted. Otherwise that email is permanently unusable — a retry
  fails with "already exists" forever. The invite flow
  (`/api/users/invite`) follows the same rule.

## Environment

| Variable | Needed for |
|---|---|
| `SUPABASE_MANAGEMENT_TOKEN` | steps 1-5 |
| `SUPABASE_ORG_ID` | step 1 |
| `SUPABASE_DEFAULT_REGION` | step 1 default |
| `GOOGLE_CLIENT_ID` / `SECRET` | step 4, Google provider |
| `VERCEL_TOKEN` / `VERCEL_DNS_TARGET` | step 7 |
| `NEXT_PUBLIC_BASE_DOMAIN` | steps 4 and 7 |
| `TENANT_SECRETS_KEY` | step 6 |

Step 7 skips itself with a message when DNS automation is unconfigured, rather
than failing the run — a tenant whose DNS you manage by hand is a normal setup.

## Deployment gotcha

Step 2 reads `.sql` files at request time. Next's output tracing cannot follow
`readdirSync`, so `next.config.ts` declares `outputFileTracingIncludes` for the
two routes that call it. **Adding another route that reads migrations means
adding it there too** — otherwise it works locally and throws ENOENT in
production.

Verify on a preview deployment, not just locally.

## Checklist

- [ ] New step is idempotent and returns a Hebrew status message
- [ ] Registered in `STEP_RUNNERS` and `TENANT_SETUP_STEPS` (order matters)
- [ ] Label added to `SETUP_STEP_LABELS`
- [ ] Partial writes rolled back inside the step where unrecoverable
- [ ] New migration-reading route added to `outputFileTracingIncludes`
- [ ] Missing optional env degrades to a skip, not a failure
