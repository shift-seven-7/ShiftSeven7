# Tenant provisioning

Two paths. Both end with a row in the registry and a working tenant.

The **first** tenant of a deployment is a special case — the console lives
inside a tenant, so it cannot create one. `/bootstrap` and
`npm run tenant:bootstrap` exist for that, and both call the same
`provisionTenant` as everything below. See [deployment.md](deployment.md) §9.

| | Automated | Manual |
|---|---|---|
| UI | `/app/admin/tenants/new-automated` | `/app/admin/tenants/new` |
| Route | `POST /api/admin/tenants/create-automated` | `POST /api/admin/tenants` |
| Creates the Supabase project | yes | no — you already did |
| Needs | `SUPABASE_MANAGEMENT_TOKEN`, `SUPABASE_ORG_ID` | nothing extra |
| Use when | the org has a free project slot | it does not, or the project exists |

The automated form also accepts an existing `Project Ref`, which adopts a
project you created by hand and runs the remaining seven steps against it.

## The eight steps

| # | Step | Does | Idempotent because |
|---|---|---|---|
| 1 | `project_created` | cost check → create → poll to `ACTIVE_HEALTHY` | skips if a ref is known |
| 2 | `migrations_applied` | replays `supabase/migrations/` | each migration is itself idempotent |
| 3 | `buckets_created` | creates missing buckets | lists existing ones first |
| 4 | `auth_configured` | site URL, redirect allow-list, and one contribution per enabled sign-in method | pure write |
| 5 | `credentials_saved` | reads the project's keys | pure read |
| 6 | `tenant_registered` | registry row, both keys sealed | returns early if the row exists |
| 7 | `domain_added` | CNAME on the base domain | checks for the record first |
| 8 | `admin_created` | first ADMIN on the tenant project | returns early if the email exists |

Progress is recorded on `tenants.setup_status`. The wizard at
`/app/admin/tenants/[id]/setup` re-runs any single step.

## Why per-step

Provisioning spans three external systems, and step 1 creates a real, billable
project. Restarting from scratch after a failure at step 6 leaks a project.

So a partial run is a **resumable state**, not garbage: fix the cause, re-run
that step, continue. Nothing is rolled back at the orchestration level.

Inside a step, rollback applies only where a partial write would be
unrecoverable — step 8 deletes the auth user if the profile insert fails, because
otherwise that email is permanently unusable and every retry fails with "already
exists".

## The cost gate

Step 1 refuses to proceed when `getProjectCost()` is non-zero:

> יצירת פרויקט נוסף בארגון כרוכה בתשלום. צור את הפרויקט ידנית…

Deliberate. Nothing should silently add a paid project to a Supabase org. Free a
slot, or use the manual path.

## Environment

| Variable | Needed for |
|---|---|
| `SUPABASE_MANAGEMENT_TOKEN` | steps 1-5 |
| `SUPABASE_ORG_ID` | step 1 |
| `SUPABASE_DEFAULT_REGION` | step 1 default |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | step 4, when `google` is enabled |
| `VERCEL_TOKEN` / `VERCEL_DNS_TARGET` | step 7 |
| `NEXT_PUBLIC_BASE_DOMAIN` | steps 4 and 7 |
| `TENANT_SECRETS_KEY` | step 6 |

Step 7 skips itself with a message when DNS automation is unconfigured — a
tenant whose DNS you manage by hand is a normal setup, not a failure.

## Step 4 and the sign-in methods

The provider settings are not hard-coded. Every method in
`NEXT_PUBLIC_AUTH_METHODS` contributes to the config body through its
`configureProject()` hook, so a phone-OTP deployment provisions tenants with an
SMS provider and no Google, and neither this step nor the Management API client
knows either exists.

A method that cannot be configured **throws**, and the step fails. That is
deliberate: a tenant provisioned with a sign-in method whose provider was never
set up is a tenant whose users discover the problem at their first login.

See [features/auth-methods.md](features/auth-methods.md).

## DNS

Assumes a wildcard domain (`*.<BASE_DOMAIN>`) is already attached to the Vercel
project, so onboarding needs a DNS record rather than a new project domain.

## Deployment gotcha

Step 2 reads `.sql` files at request time. Next's output tracing cannot follow
`readdirSync`, so `next.config.ts` declares `outputFileTracingIncludes` for the
two routes that call it:

```ts
outputFileTracingIncludes: {
  '/api/admin/tenants/create-automated': ['./supabase/migrations/**'],
  '/api/admin/tenants/[id]/setup/run-step': ['./supabase/migrations/**'],
  '/api/bootstrap': ['./supabase/migrations/**'],
}
```

Adding another route that reads migrations means adding it there too — otherwise
it works locally and throws ENOENT in production. Verify on a preview
deployment.

## Manual checklist

If you provision by hand:

1. Create the Supabase project
2. Run `supabase/migrations/` against it, in filename order
3. Create the `avatars`, `media`, `documents` buckets per `lib/storage/config.ts`
4. Set the site URL and redirect allow-list, and configure the providers for
   whichever methods `NEXT_PUBLIC_AUTH_METHODS` lists
5. Register at `/app/admin/tenants/new` with the URL and keys
6. Add the CNAME
7. Create the first ADMIN — easiest via the setup wizard's step 8
