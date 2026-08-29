# Deployment — from zero

From "I have nothing" to a first live tenant. For local work see
[getting-started.md](getting-started.md).

**Read section 1 before opening any accounts** — it contains one decision
(region) that is expensive to change later.

> The app's UI is Hebrew. Where this guide names a screen or a button it quotes
> the Hebrew string, with a translation.

---

## 0. What you are building

```
                    ┌──────────────────────┐
   example.com ───► │ Vercel (fra1)        │
   *.example.com    │ the Next.js app      │
                    └──────────┬───────────┘
                               │ subdomain resolution
                    ┌──────────▼───────────┐
                    │ Supabase master      │  one project
                    │ the tenants table    │  eu-central-1
                    └──────────┬───────────┘
              ┌────────────────┼────────────────┐
        ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
        │ Supabase  │    │ Supabase  │    │ Supabase  │
        │ acme      │    │ beta      │    │ …         │  one per tenant
        └───────────┘    └───────────┘    └───────────┘
```

**Every tenant is a separate Supabase project.** That decision drives both the
isolation guarantee and the cost — see section 2.

---

## 1. Region — Frankfurt, in both layers

**Decide now.** A Supabase project's region cannot be changed after creation;
moving means a dump and restore.

| Layer | Value | Where |
|---|---|---|
| Supabase (master + every tenant) | `eu-central-1` — Central EU (Frankfurt) | the region picker when creating a project |
| Vercel (function execution) | `fra1` | already pinned in `vercel.json` |
| Automated tenant provisioning | `SUPABASE_DEFAULT_REGION=eu-central-1` | environment variable |

**Why it matters:** every API request makes several round trips to Postgres. A
function in Washington talking to a database in Frankfurt adds roughly 150ms per
round trip — tens of milliseconds to half a second on every screen. In the same
region it is close to zero.

An EU region is also a convenient starting point for GDPR, since user data stays
inside the EU. (London and Zurich are *not* in the EU — if that matters to you,
pick an EU region explicitly rather than the general "Europe" grouping.)

> If most of your users are not in Europe, change both values together. The rule
> is **database and application in the same region**, not Frankfurt specifically.

---

## 2. Accounts and costs

In order. The first three are required.

| # | Service | For | Note |
|---|---|---|---|
| 1 | [GitHub](https://github.com) | the code; Vercel builds from it | |
| 2 | [Supabase](https://supabase.com) | the master and every tenant | sign in with GitHub |
| 3 | [Vercel](https://vercel.com) | hosting + DNS | sign in with GitHub |
| 4 | A domain registrar | `example.com` | can be bought through Vercel |
| 5 | [Google Cloud](https://console.cloud.google.com) | operator sign-in to `/backoffice`; optionally tenant sign-in too | required — the backoffice is Google-only |

### Costs — the shape, not the numbers

Prices change; check the pricing pages. What matters is the **structure**:

- **Supabase** — the free plan caps active projects per organization (2 at the
  time of writing). **Every tenant is a project.** So: master + one tenant
  exhausts the free tier, and the second tenant already needs a paid plan. This
  is the real cost of the architecture, and it is better known before the second
  customer than after. [Pricing](https://supabase.com/pricing)
- **Vercel** — Hobby is free but **not licensed for commercial use**. A project
  that charges money needs Pro. [Pricing](https://vercel.com/pricing)
- **Domain** — annual.
- **Google OAuth** — free.

A guard already exists in the code: automated provisioning checks the cost
before creating a project and **refuses** if it is not zero. You will not
discover a charge after the fact.

---

## 3. The repo on your machine, and GitHub

Several steps below are run **from your machine** against the cloud — creating
the registry table, provisioning the first tenant, applying migrations. So the
repo has to be installed locally first, even though nothing local is being
deployed.

```bash
git clone <repo-url> && cd <repo>
npm install
cp .env.example .env.local
```

`.env.local` is where every value you collect from here on gets written. It is
git-ignored, it is never deployed, and it is what the CLI scripts read. The
same values also go into Vercel by hand in section 7 — the two are separate
places and neither reads the other.

Right now, one edit: `.env.example` ships with `USE_LOCAL_DB=true`, which is
correct for local development and **wrong for everything in this guide**. Comment
both lines out or set them to `false`:

```bash
# USE_LOCAL_DB=true
# NEXT_PUBLIC_USE_LOCAL_DB=true
```

Leave the rest of the file as it is; the sections below fill it in.

Then push:

```bash
git remote add origin git@github.com:<user>/<repo>.git
git push -u origin main
```

Make sure `.env.local` is not pushed — it is already in `.gitignore`. If you do
push secrets by accident, rotate them; deleting the commit is not enough.

---

## 4. The Supabase master project

This is the tenant registry — one table. It holds no user data.

1. **New project**
   - Name: `<project>-master`
   - Region: **Central EU (Frankfurt)** → `eu-central-1`
   - Save the database password in a password manager

### Where each value comes from

Five values, from three screens. The dashboard has been reorganised more than
once, so this lists **what to look for** as well as where it currently lives.

| Variable | Where | What you are looking for |
|---|---|---|
| `MASTER_SUPABASE_URL` | Project → **Settings → Data API** (older dashboards: *Settings → API*) | The **Project URL**, `https://<ref>.supabase.co`. The `<ref>` in it is the project ref the scripts derive automatically — you never set it separately |
| `MASTER_SUPABASE_SERVICE_KEY` | Project → **Settings → API Keys** | The **secret** key. Newer projects show `sb_secret_…` under *Secret keys*; older ones show a JWT labelled `service_role`. Either works. **Not** the `anon` / publishable one |
| `MASTER_SUPABASE_ANON_KEY` | the same screen | The **publishable** / `anon` key — the other one. Operators sign in to `/backoffice` against this project, and that sign-in runs in a browser, so it uses the publishable key and RLS applies |
| `SUPABASE_MANAGEMENT_TOKEN` | **Account** (your avatar, top right) → **Access Tokens** → *Generate new token* | A `sbp_…` token. This is an *account* token, not a project one, and it can create and delete projects — treat it exactly like a password. Shown once |
| `SUPABASE_ORG_ID` | **Organization → Settings → General** | The organization **ID**, a short slug like `abcdefghijklmnopqrst` — not the display name. It is also the `/org/<id>/` segment in the dashboard URL |

> The service key and the management token both bypass every access control.
> Server only, never in a browser, never in git.

Write all five into `.env.local`.

### Creating the `tenants` table

The registry project is empty — the table has to be created before anything can
resolve a tenant. Two migration files ship in `master_migrations/`: the baseline
and the encrypted secrets bag.

**Check `USE_LOCAL_DB` first.** The script picks its target from that variable
alone: `true` sends everything to your local Docker stack, anything else to the
hosted project. If you skipped the edit in section 3, this quietly migrates the
wrong database and the hosted one stays empty. The first line of output tells
you which it chose:

```
target: hosted master project      ← what you want here
target: local Supabase stack       ← USE_LOCAL_DB is still true
```

```bash
npm run sync-master-migrations -- --dry-run
npm run sync-master-migrations
```

Needs `MASTER_SUPABASE_URL` and `SUPABASE_MANAGEMENT_TOKEN` — the SQL runs
through the Management API, not through a database connection, so there is
nothing to allow-list and no password to supply.

Re-running is a no-op: each file is recorded in `_master_applied_migrations`
once it succeeds.

Verify in the dashboard — **Table Editor** should now show `tenants` and
`_master_applied_migrations`.

---

## 5. Domain

1. Buy `example.com` (Vercel → Domains, or any registrar)
2. If bought elsewhere — add it in Vercel and point the nameservers
3. In Vercel → Project → Settings → Domains add **two**:
   - `example.com`
   - **`*.example.com`** ← this is what makes every tenant work

Without the wildcard, each new tenant needs a domain added by hand.

4. For `VERCEL_DNS_TARGET` — take the CNAME value the dashboard shows for the
   domain (something like `xxxx.vercel-dns-017.com`). That is what the automated
   step points records at.

---

## 6. Vercel

1. **Add New → Project** → import the repo. Next.js is detected automatically
2. Do not deploy yet — set the environment variables first (section 7)
3. **Settings → Functions → Region: Frankfurt (fra1)**. `vercel.json` already
   sets `"regions": ["fra1"]`; make sure the dashboard does not contradict it
4. **Settings → General** → copy the Project ID → `VERCEL_PROJECT_ID`
5. **Account/Team Settings → Tokens** → create one → `VERCEL_TOKEN`. On a team,
   also `VERCEL_TEAM_ID`

---

## 7. Environment variables in Vercel

Settings → Environment Variables. Add to Production and Preview.

Most of these are already in your `.env.local` from the sections above. Vercel
does not read that file — copy each value across by hand.

### Required

| Variable | Where from |
|---|---|
| `MASTER_SUPABASE_URL` | section 4 |
| `MASTER_SUPABASE_SERVICE_KEY` | section 4 |
| `MASTER_SUPABASE_ANON_KEY` | section 4 — the *publishable* key of the master project. Only `/backoffice` uses it |
| `TENANT_SECRETS_KEY` | `npm run secrets:generate-key`, then into `.env.local` **and** here — the same value in both, or tenants created from the CLI cannot be read by the deployed app |
| `NEXT_PUBLIC_BASE_DOMAIN` | `example.com`. **Set it before provisioning any tenant** — see below |
| `NEXT_PUBLIC_AUTH_METHODS` | `password`, or a comma-separated list — see [auth-methods.md](features/auth-methods.md) |
| `PLATFORM_OPERATOR_EMAILS` | your own address. **Set this before the second tenant** — see below |

> ### Set `PLATFORM_OPERATOR_EMAILS`
> This is what admits you to `/backoffice` — and there it is the **only**
> authorization. The master project has no roles and no user table, and Google
> will mint a session for any address on earth, so an empty list admits
> **nobody**. Put your own address in before you deploy or you will sign in
> successfully and be refused.
>
> In the in-tenant console at `/app/admin/tenants` an empty list falls back to
> the `ADMIN` role instead — the pre-existing behaviour, tolerable for one
> customer and wrong for two, since every customer's own administrator holds
> that role.

> ### `NEXT_PUBLIC_BASE_DOMAIN` is a **bare host**
> `example.com` — not `https://example.com/`, no scheme, no path, no port. A
> full URL is the natural mistake and it used to propagate silently into tenant
> URLs, into the new Supabase project's *name*, and into that project's auth
> Site URL. The value is now normalised and `/api/health` reports what it was
> read as under `baseDomain`, but set it correctly and save yourself the
> round trip.
>
> Set it to the domain you **intend to use**, even before you own it. Pointing
> it at your `*.vercel.app` URL does not work: wildcard subdomains of
> vercel.app are not yours, so `acme.<project>.vercel.app` can never resolve.
> Until DNS exists, reach tenants with `?tenant=<subdomain>` on the deployment
> URL — the backoffice already links that way on its own.

> ### `NEXT_PUBLIC_BASE_DOMAIN` is not optional
> Unset, it falls back to `localhost` and **nothing fails loudly**. Tenant links
> point at `*.localhost`, and provisioning step 4 writes
> `https://acme.localhost` into the new tenant project's auth Site URL — so its
> password-reset emails carry a dead link, which you discover when a customer
> cannot sign in. Set it before creating a tenant; if you already did, re-run
> step 4 for that tenant afterwards.
>
> `/api/health` reports it under `baseDomain.configured`.

> ### Back up `TENANT_SECRETS_KEY`
> It encrypts every tenant's Supabase credentials. **If it is lost, no tenant
> resolves**, and recovery means pulling the keys out of every project by hand
> and re-registering them. Put a copy in a password manager **before** the first
> deploy.

### For automated provisioning

| Variable | Value |
|---|---|
| `SUPABASE_MANAGEMENT_TOKEN` | section 4 — the account access token |
| `SUPABASE_ORG_ID` | section 4 |
| `SUPABASE_DEFAULT_REGION` | `eu-central-1` |
| `VERCEL_TOKEN` · `VERCEL_PROJECT_ID` · `VERCEL_DNS_TARGET` | sections 5-6 |
| `VERCEL_TEAM_ID` | teams only |

### Optional

| Variable | Effect |
|---|---|
| `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | required when `google` is in `NEXT_PUBLIC_AUTH_METHODS` |
| `DEFAULT_PREVIEW_TENANT` | which tenant preview deployments resolve to. **Leave empty** unless you have a dedicated test tenant — otherwise every preview reads and writes real data |
| `NEXT_PUBLIC_APP_NAME` · `NEXT_PUBLIC_APP_NAME_HE` | the product name in the UI |
| `BOOTSTRAP_TOKEN` | opens `/bootstrap` for the first tenant — section 9. Remove it afterwards |

**Do not set** `USE_LOCAL_DB` in production.

Now **Deploy**. Verify: `https://example.com/api/health` returns
`{"status":"ok"}`. `degraded` means either the master is unreachable (check the
two master variables) or `TENANT_SECRETS_KEY` is missing or malformed — the
response says which.

---

## 8. Google OAuth

Needed for **two independent things**, and it is worth keeping them apart:

| For | Required? | Project it is configured on |
|---|---|---|
| operators signing in to `/backoffice` | yes, that screen is Google-only | the **master** project |
| tenant users signing in | only if `google` is in `NEXT_PUBLIC_AUTH_METHODS` | **each tenant's** project |

### 8a. One OAuth client in Google Cloud

1. Google Cloud → **APIs & Services → Credentials → OAuth client ID → Web**
2. **Authorized redirect URIs** — the **Supabase** callback, not yours:
   ```
   https://<master-project-ref>.supabase.co/auth/v1/callback
   https://<tenant-project-ref>.supabase.co/auth/v1/callback
   ```
   One line per Supabase project, master included. A new tenant means a new
   line, and this is the step most easily forgotten.
3. Client ID + Secret → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in Vercel

### 8b. The master project — for the backoffice

In the **master** project's dashboard:

1. **Authentication → Sign In / Providers → Google** → enable, paste the same
   Client ID and Secret
2. **Authentication → URL Configuration**
   - *Site URL*: `https://example.com`
   - *Redirect URLs*: add `https://example.com/**` (and the `*.vercel.app` URL
     while you are still testing without a domain)

Without step 2 the sign-in completes at Google and then fails on the way back,
because Supabase refuses a `redirectTo` it was not told about.

> **Anyone with a Google account can obtain a session on the master project** —
> there is no user table there to gate it. They can do nothing:
> `PLATFORM_OPERATOR_EMAILS` is checked on every call, and a non-listed address
> gets a screen telling it so. To stop the accounts being created at all,
> disable sign-ups on the master project after your own account exists.

### 8c. Tenant projects

Provisioning step 4 configures the provider on each new tenant project
automatically. Every enabled sign-in method contributes its own settings there,
so a deployment whose `NEXT_PUBLIC_AUTH_METHODS` does not list `google` never
configures it on a tenant — while the backoffice still uses it.

---

## 9. The first tenant

**This is where the chicken-and-egg is.** The tenant console lives at
`/app/admin/tenants` — inside a tenant. Reaching it means being an `ADMIN` on a
tenant that already exists, so the first one cannot be created there.

Two ways round it. Both run the same eight steps
([provisioning.md](provisioning.md)) — there is no second implementation.

### From the browser — `/bootstrap`

1. Set `BOOTSTRAP_TOKEN` in Vercel to a random string and redeploy:
   ```bash
   openssl rand -base64 24
   ```
2. Open `https://example.com/bootstrap` — or, before DNS exists, the
   `*.vercel.app` URL of the deployment
3. Enter the token, the subdomain, the organisation name, the region and the
   first admin's email
4. A few minutes; the result is reported step by step

**The route is guarded twice**, because it provisions billable projects for a
caller with no account:

| Condition | Effect |
|---|---|
| `BOOTSTRAP_TOKEN` unset | the route answers 404 — it does not exist |
| the token does not match | 403 |
| any tenant already exists | the screen closes itself and says so |

So it is open only between your first deploy and your first tenant, and only to
someone holding the token. **Remove `BOOTSTRAP_TOKEN` afterwards** — nothing
else uses it.

### From the CLI — `tenant:bootstrap`

No token, no deploy needed; it runs from your machine against the same registry.

```bash
npm run tenant:bootstrap -- \
  --subdomain=acme \
  --name="Acme Corp" \
  --admin=you@example.com \
  --region=eu-central-1
```

### Either way

Created the Supabase project by hand? Pass the project ref — `--existing-ref=…`
on the CLI, the *Project Ref קיים* field in the browser — and step 1 is skipped.

When it finishes: `https://acme.example.com`. The first admin was created
without a password, so sign in with "forgot password" to set one, or with a
provider if you enabled one. (The first admin is always created by email
address, whatever `NEXT_PUBLIC_AUTH_METHODS` says.)

**Stopped partway?** Nothing was rolled back. Fix the cause and re-run the
failed step at `/app/admin/tenants/[id]/setup`, or run either path again. Every
step is idempotent — but do not create a second Supabase project by hand in the
meantime.

Once this succeeds, `/bootstrap` closes itself for good and the operator's entry
point becomes `/backoffice` — section 10.

---

## 10. Every tenant after that

From here it is all UI. **`https://example.com/backoffice`** is the operator's
entry point — it works on the apex, signs you in with Google against the master
project, and does not require an account inside any customer's database.

1. `https://example.com/backoffice` → **המשך עם Google**
2. **"טננט חדש"** → subdomain, name, region (**Frankfurt**), admin email
3. A few minutes — creating the Supabase project is the slow part
4. Per-step result; if something failed → the setup wizard, reachable from the
   tenant's own console via the **ניהול** button

The per-tenant console at `acme.example.com/app/admin/tenants` still exists and
still works. The backoffice is the door in front of it, not a replacement:
anything scoped to one tenant — its settings, its logo, its module matrix —
lives there.

**When to fall back to manual registration:** once the Supabase organization has
used up its free projects, step 1 stops with a message that project creation
costs money. Then: create the project by hand (**Frankfurt**) and register it
under **"רישום ידני"** (*manual registration*), or run `tenant:bootstrap` with
`--existing-ref`.

---

## 11. Schema changes once tenants exist

```bash
# new migration — a new file, never edit an existing one
npm run sync-tenant-migrations -- --tenant=acme --dry-run
npm run sync-tenant-migrations -- --tenant=acme     # one, to verify
npm run sync-tenant-migrations                       # the rest
```

Details: [migrations.md](migrations.md).

---

## 12. Troubleshooting

| Symptom | Cause |
|---|---|
| `sync-master-migrations` prints `target: local Supabase stack` | `USE_LOCAL_DB=true` is still in `.env.local` — section 3. Nothing reached the hosted project |
| `Could not find the table 'public._master_applied_migrations' in the schema cache` | An old checkout. The script used to create that table over the Management API and then read it back over PostgREST, whose schema cache had not caught up yet. Pull and re-run |
| A tenant created from the CLI resolves locally but not on the deployed app | `TENANT_SECRETS_KEY` differs between `.env.local` and Vercel. The credentials were sealed with one key and are being opened with another |
| `npm run dev` lands on `/tenant-not-found` after following this guide | `USE_LOCAL_DB` is still commented out from section 3. Local development wants it back at `true` |
| `/api/health` returns `degraded` | `MASTER_SUPABASE_URL`/`SERVICE_KEY` wrong or missing, or `TENANT_SECRETS_KEY` unusable — the `encryption` field says which |
| The registry console 403s for an admin | their address is not in `PLATFORM_OPERATOR_EMAILS` |
| `/backoffice` says it is not configured | `MASTER_SUPABASE_ANON_KEY` is missing — section 4 |
| `/backoffice` signs in and then refuses | that Google address is not in `PLATFORM_OPERATOR_EMAILS`. The screen names the address it saw |
| Backoffice sign-in fails after Google | the app's URL is not in the **master** project's redirect allow-list — section 8b |
| `/bootstrap` returns 404 | `BOOTSTRAP_TOKEN` is not set in the deployed environment, or was set without redeploying |
| `/bootstrap` says setup is already done | a tenant exists. Create further tenants from the console — section 10 |
| Tenant links point at `something.localhost` | `NEXT_PUBLIC_BASE_DOMAIN` is unset in the deployed build. It is inlined at build time, so set it **and redeploy** |
| Provisioning fails at step 4 naming an auth method | an enabled method has no provider configured — see [auth-methods.md](features/auth-methods.md) |
| A new tenant gives `/tenant-not-found` | DNS has not propagated yet (up to ~a minute), or the wildcard record is missing. Check with `dig acme.example.com` |
| An existing tenant gives `/tenant-not-found` | the proxy caches for 5 minutes and each instance holds its own copy. Redeploy to clear it immediately |
| Google sign-in: `redirect_uri_mismatch` | the new tenant project's callback was not added in Google Cloud (section 8) |
| Provisioning fails at step 2 with ENOENT | a new route that reads migrations was not added to `outputFileTracingIncludes` in `next.config.ts` |
| Provisioning fails at step 1 with a billing message | no free project slot. See section 10 |
| Decryption errors after changing a key | `TENANT_SECRETS_KEY` was replaced without a rotation. Put the old one back in `TENANT_SECRETS_KEY_PREVIOUS` and run `npm run secrets:rotate` |
