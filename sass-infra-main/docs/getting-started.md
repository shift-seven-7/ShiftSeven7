# Getting started — local development

From a clone to creating tenants and switching between them, entirely on your
machine with no cloud account.

For production, see [deployment.md](deployment.md).

> The app's UI is Hebrew. Where this guide names a screen or a button it quotes
> the Hebrew string, with a translation, so you can find it on screen.

---

## 1. Prerequisites

Node ≥ 20.9, Docker Desktop **running**, and the Supabase CLI. Install commands
are in the [README](../README.md#prerequisites).

Quick check:

```bash
node -v && docker info > /dev/null && supabase -v && echo "ready"
```

If `docker info` fails, Docker Desktop is not running. That is the most common
cause of trouble further down.

---

## 2. Install

```bash
npm install
cp .env.example .env.local
```

### The encryption key — required

```bash
npm run secrets:generate-key
```

Copy the value into `TENANT_SECRETS_KEY` in `.env.local`.

Without it **every write to the tenant registry fails** — including the seed and
including creating a tenant from the UI. Reads still work (plaintext passes
through untouched), so the failure only shows up on the first save.

### Start local Supabase

```bash
npm run db:start
npm run db:status
```

`db:status` prints the whole environment. Three values go into `.env.local`:

| From `db:status` | Variable in `.env.local` |
|---|---|
| `API_URL` | `LOCAL_TENANT_SUPABASE_URL` |
| `ANON_KEY` | `LOCAL_TENANT_SUPABASE_ANON_KEY` |
| `SERVICE_ROLE_KEY` | `LOCAL_TENANT_SUPABASE_SERVICE_KEY` |

> The CLI also prints `PUBLISHABLE_KEY` and `SECRET_KEY` — the newer format
> (`sb_publishable_…` / `sb_secret_…`). Both formats work; `ANON_KEY` and
> `SERVICE_ROLE_KEY` are the safe choice.

Make sure `LOCAL_TENANT_SUBDOMAIN=local` (the default).

---

## 3. Initialise the database

```bash
npm run db:init
```

Four steps:

| Step | What it does |
|---|---|
| `db:start` | brings up the containers |
| `db:migrate` | `supabase/migrations/` → the tenant schema (`users`, `files`, …) |
| `db:migrate:master` | `master_migrations/` → **the `tenants` table**, the registry |
| `db:seed` | three demo tenants: `local`, `acme`, `beta` |

**Why `db:migrate:master` is needed locally:** `npm run dev` resolves tenants
through the registry exactly as production does — the env bypass is disabled on
purpose so local behaviour matches. Without a `tenants` table nothing resolves
and every request rewrites to `/tenant-not-found`.

---

## 4. Run

```bash
npm run dev
```

Open **`http://local.localhost:3000`**.

---

## 5. Switching tenants locally

This is the point — each subdomain is a different tenant, exactly as in
production:

| Address | What happens |
|---|---|
| `local.localhost:3000` | the tenant seeded as the default |
| `acme.localhost:3000` | a different tenant — different name and identity |
| `beta.localhost:3000` | a third |
| `localhost:3000` | falls back to `LOCAL_TENANT_SUBDOMAIN` |
| `nosuch.localhost:3000` | `/tenant-not-found` — what an unknown subdomain looks like |
| `localhost:3000/?tenant=acme` | explicit override, handy for testing |

`localhost` subdomains resolve automatically on macOS and in modern browsers —
no need to touch `/etc/hosts`.

### What this really exercises, and what it doesn't

Locally there is **one Supabase project**, so all three tenants point at the
same database and share users and data.

| Genuinely exercised | Not exercised |
|---|---|
| subdomain resolution | data isolation between tenants |
| registry lookup | |
| credential encryption and decryption | |
| the proxy cache | |
| the tenant admin console | |

In production each tenant gets its own Supabase project, and the isolation is
physical.

---

## 6. The first user

There are no users yet. Sign up at `/auth/sign-up`.

Locally, email confirmation is off (`enable_confirmations = false` in
`supabase/config.toml`), so the account is created and signed in immediately
with no email. You land on **"ממתין לאישור"** (*pending approval*), and that is
the correct state: registration succeeded, but `app_role` is `NULL` and there is
no admin to approve you.

To promote yourself:

```bash
supabase db query --local \
  "update public.users set app_role='ADMIN' where email='YOUR@EMAIL'"
```

Or use Supabase Studio at `http://127.0.0.1:54323` → Table Editor → `users`.

Refresh — the full menu appears.

> If you turn email confirmation on in `config.toml`, messages land in Mailpit
> at `http://127.0.0.1:54324`, not in a real inbox.

---

## 7. The sidebar

Once you have a role, the sidebar shows:

| Hebrew label | Meaning | Route | Visible to |
|---|---|---|---|
| עמוד הבית | Home | `/app/home` | any role |
| משתמשים | Users | `/app/users` | any role |
| הגדרות מערכת | System settings | `/app/settings` | any role |
| **ניהול טננטים** | **Tenant management** | `/app/admin/tenants` | `ADMIN` only |

Module nav items appear here too, once a module is registered and the tenant has
it enabled.

---

## 8. A tour of the tenant console

| Page | Route | What's there |
|---|---|---|
| List | `/app/admin/tenants` | every tenant, plan, status, setup progress |
| Manual registration | `/app/admin/tenants/new` | connect an existing Supabase project |
| Automated provisioning | `/app/admin/tenants/new-automated` | full project creation — needs tokens, see below |
| One tenant | `/app/admin/tenants/[id]` | three tabs: "פרטי טננט" (details) · "הגדרות לקוח" (client settings) · "תנאי שימוש" (terms) |
| Setup wizard | `/app/admin/tenants/[id]/setup` | the eight steps, each individually re-runnable |

---

## 9. Creating a tenant locally

This is the proof that the loop closes.

1. `/app/admin/tenants` → **"רישום ידני"** (*manual registration*)
2. Fill in:

   | Field | Local value |
   |---|---|
   | Subdomain | `demo` |
   | Name | `Demo Ltd` |
   | Project Ref | `local` |
   | Project URL | the `API_URL` value |
   | anon key | the `ANON_KEY` value |
   | service role key | the `SERVICE_ROLE_KEY` value |

3. Save → the tenant appears in the list
4. Open **`http://demo.localhost:3000`** — it resolves immediately

**Automated provisioning** (`new-automated`) creates a real Supabase project in
the cloud, so it needs `SUPABASE_MANAGEMENT_TOKEN` and `SUPABASE_ORG_ID`.
Without them the first step fails with a clear message and the rest wait in the
wizard. Locally, use manual registration.

### Resetting the demo tenants

```bash
npm run db:seed -- --reset
```

Deletes and recreates only `local`, `acme` and `beta`. Tenants you created
yourself are left alone.

This is also the recovery path after changing `TENANT_SECRETS_KEY`: the old
credentials can no longer be decrypted, and the seed re-seals them.

---

## 10. Useful commands

| Command | What it does |
|---|---|
| `npm run db:status` | URLs and keys for the local stack |
| `npm run db:seed -- --reset` | reset the demo tenants |
| `npm run db:reset` | wipe the DB, re-run every migration, re-seed |
| `supabase db query --local "select subdomain, status from public.tenants"` | peek at the registry |
| `npx tsc --noEmit && npx eslint .` | the checks that run on every change |

---

## 11. Troubleshooting

| Symptom | Cause |
|---|---|
| Everything lands on `/tenant-not-found` | Run `npm run db:init`. If it persists, check that `LOCAL_TENANT_SUPABASE_*` are filled in — the proxy prints an explicit warning in the terminal |
| `Cannot read public.tenants` during seed | `npm run db:migrate:master` was not run |
| `TENANT_SECRETS_KEY is not set` | run `npm run secrets:generate-key` and add it to `.env.local` |
| Signed up and stuck on "ממתין לאישור" | Working as intended. Promote yourself to `ADMIN` — section 6 |
| `db:start` hangs | Docker Desktop is not running |
| A tenant still reads as suspended/deleted after a change | the proxy caches connection details for 5 minutes. Restart `npm run dev` |
| A client-settings change doesn't show | those are **not** cached. Refresh; if it persists, check that the save succeeded |
