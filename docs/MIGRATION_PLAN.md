# Base44 → Next.js + Supabase Migration: Setup + Technical Plan

**Revision note:** this plan replaces an earlier FastAPI + PostgreSQL + Redis + Celery + Docker design. That direction was abandoned before any of it was deployed — the target stack is now **Next.js (TypeScript) + Supabase + Vercel**, no Docker, no self-hosted services. The old `services/`, `docker-compose.yml`, and `deploy/` have been removed from the repo.

**Second revision note:** the plan originally kept the old Base44/Vite app (`src/`, `base44/`) in the repo, untouched, until cutover (Phase 5/6 below) — as a safety net for the pre-cutover comparison walk and as reference source while porting pages. That app has since been **removed from this branch** ahead of schedule. It's still recoverable from git history (`main`/`develop` have it, or `git show main:<path>` for a single file) — see `CLAUDE.md`'s "Where the old app went" section. The Phase 5 pre-cutover comparison now has to happen against the *live* Base44-hosted app (base44.com) directly, not a local checkout.

## Context

`shift-seven` (product name **GuardSync**/"Secure Shift Flow") was a React SPA (Vite, JavaScript) that depended entirely on the Base44 platform for auth, data storage, and business logic (`base44.entities.*`, `base44.functions.invoke`) — that app has been removed from this branch (see revision note above). The goal is a **pure stack migration** — same features, same UX, same domain model — rebuilt on Next.js + Supabase + Vercel.

Two developers are doing this migration together: Claude Code (CLI, in this repo) for implementation, Claude.ai Projects as a shared space for architecture/design discussion. Confirmed decisions:
- **Big-bang migration**: build the full new app, cut over once (not incremental strangler-fig against the live Base44 app).
- **New Next.js app in its own directory** (`/web`), not a conversion of the old `src/` in place — that app has since been removed from this branch (see revision note above), but the decision to build fresh rather than convert in place still shaped the architecture below.
- **Client-side data fetching**: React Query + the Supabase JS client from Client Components, not a Server-Components-first rewrite — this lets most of the existing component logic (loading states, mutation patterns, forms) port over with minimal restructuring, at the cost of being less "idiomatic" Next.js.
- **Row Level Security (RLS) is the primary authorization boundary** — Postgres policies enforce access per table, not just application-code checks.
- **Backend logic lives in Next.js** (Route Handlers / Server Actions), scheduled via **Vercel Cron** — no separate services, no Celery, no Redis.
- **Hosted Supabase Cloud project for dev** — no local Docker-based Supabase CLI stack for now; both devs develop against a shared/dev Supabase project directly.
- Domain model and business logic are unchanged from Base44 — see below, extracted directly from the live Base44 entity/function definitions.

## Part A — How to set Claude up for 2 developers

The git repo is the only thing both developers and every future Claude Code session share automatically. If it should shape how Claude Code behaves or what it knows about this project, it goes in a committed file, not in a chat.

1. **`CLAUDE.md`** (repo root) documents the current state and points to this plan and the architecture docs; also explains how to recover the old Base44/Vite app's code from git history if you need to check original behavior while porting a page. Keep it updated as `/web` grows.
2. **This document** (`docs/MIGRATION_PLAN.md`) is the shared source of truth for schema, RLS policies, and phase/ownership breakdown — reference it by path in commits/PRs.
3. **Claude.ai Project** ("GuardSync Migration") — shared space for design discussion, not implementation. Upload `architecture/ARCHITECTURE_RECOMMENDED.md`, `DOMAIN_MODEL.md`, `docs/LLM_RULES.md`, and this plan; re-upload after major revisions (Projects don't auto-sync with git). If you're on individual Pro accounts rather than Team/Enterprise, each of you creates your own Project pointed at the same files — the repo stays the actual source of truth either way.
4. **Task tracking**: GitHub Issues, one per page/feature slice from §B.6 below, referenced in PR titles. `docs/LLM_RULES.md` requires small PRs, one feature per branch, a CHANGELOG entry.
5. **Branch/PR flow**: `develop` is the integration branch off `main`; `feature/migration` (branched from `develop`) is where this migration's work happens. Once the migration is far enough along to split across the two devs independently, cut further `feature/*` branches from `develop` per slice and PR back into `develop`; CI (needs rewriting for Node/TypeScript — see §B.7) is the shared automated check.

---

## Part B — Technical architecture

### B.1 App structure

- **`/web`** — new Next.js app (App Router, TypeScript strict), its own `package.json`/`node_modules`/`tsconfig.json`, not an npm workspace with the existing root app. Scaffolded with `create-next-app` (TypeScript, App Router, Tailwind — matches the existing app's Tailwind + shadcn/ui setup), which defaults to a `web/src/` layout (`web/src/app`, `web/src/components`, `web/src/lib`) — later references to `web/app/...` or `web/components/...` in this doc mean `web/src/app/...` / `web/src/components/...`. **Next.js 16**, installed via `create-next-app@latest`, renamed `middleware.ts` to `proxy.ts` (function `proxy`, not `middleware`) — this plan uses the new name throughout; check `web/node_modules/next/dist/docs/` before writing App Router code, since v16 has other breaking changes from what any given session might expect.
- **UI primitives**: regenerated fresh into `web/src/components/ui/` via the shadcn CLI rather than hand-porting the old app's `.jsx` files — guarantees Next.js/TypeScript-correct output. Note: shadcn's CLI has moved on from the old `components.json` "style: new-york" format since the old app was scaffolded — this project uses the current CLI's `radix` base + `nova` preset (Lucide icons, matching the old app's icon library), not literally "new-york"; see the generated `web/components.json` for the actual config in use.
- No Docker, no `docker-compose.yml` — Next.js runs locally via `npm run dev` in `/web`, deploys to Vercel; Supabase is a hosted Cloud project, no local Postgres container.

### B.2 Database schema & Storage buckets

Supabase's two data pillars this app leans on: **Database** (Postgres, with the schema below) and **Storage** (file uploads, see the bucket definition at the end of this section). Auth's role-based access to both is covered together in §B.3, since it's driven by the same mechanism.

One hosted Supabase Cloud project for dev (name it `guardsync-dev` or similar), created via the Supabase dashboard; migrations authored as SQL files under `web/supabase/migrations/` and applied with `supabase db push` (linking the CLI to the hosted project — this does **not** require Docker; only `supabase start`, the local full-stack emulator, does, and we're not using that for now). Consider a separate Supabase project for staging/prod when you get to Phase 5 cutover, rather than reusing the dev project.

`auth.users` (Supabase-managed) is the login identity table — no custom `users` table needed. `staff.user_id` links an HR roster row to a login identity, one-directional (no circular FK issue, unlike the earlier FastAPI design). `staff.access_level` is the **single** authorization field — this replaces the earlier plan's two-tier `users.role`/`staff.access_level` split, which existed only because Base44 modeled `User` and `Staff` as separate entities. It's typed as a Postgres enum (`app_role`, defined below) rather than `text` + `check`, matching Supabase's own role-based-access convention, and it's what gets projected into the JWT as a custom claim in §B.3.

```sql
-- enum backing staff.access_level, also the type of the JWT custom claim (§B.3)
create type public.app_role as enum ('admin', 'scheduler', 'employee', 'no_access');

facilities(
  id uuid primary key default gen_random_uuid(),
  name text not null, code text not null unique, address text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
)

staff(
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),               -- nullable: login identity, if any
  full_name text not null, employee_id text not null unique,
  role text not null check (role in ('guard','dispatcher')),
  qualification text not null default 'none' check (qualification in ('none','shift_supervisor','lead_dispatcher')),
  primary_facility uuid not null references facilities(id),
  phone text, email text,
  status text not null default 'active' check (status in ('active','on_leave','inactive')),
  access_level public.app_role not null default 'employee',
  weapon_license_expiry date, weapon_refresh_expiry date, medical_check_expiry date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
)
-- index: (primary_facility), (status), (user_id)

staff_credential_notification_state(
  staff_id uuid references staff(id) on delete cascade,
  credential_key text check (credential_key in ('weapon_license_expiry','weapon_refresh_expiry','medical_check_expiry')),
  state text not null default 'none' check (state in ('none','urgent','expired')),
  updated_at timestamptz not null default now(),
  primary key (staff_id, credential_key)
)
-- replaces Base44's Staff.expiry_notified packed string; only ever touched server-side
-- (service-role key, bypasses RLS) by the credential-expiry cron route

posts(
  id uuid primary key default gen_random_uuid(),
  name text not null, code text not null,
  type text not null check (type in ('static','control_room')),
  facility uuid not null references facilities(id),
  required_role text not null check (required_role in ('guard','dispatcher')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (facility, code)
)

shift_templates(
  id uuid primary key default gen_random_uuid(),
  code text not null, name text not null,
  category text not null check (category in ('morning','afternoon','night')),
  start_time time not null, end_time time not null,
  duration_hours numeric(4,2) not null,
  post_number integer, color text,
  applicable_roles text[] not null,
  facility uuid references facilities(id),               -- null = global template
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
)

shift_assignments(
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id), staff_name text not null,
  shift_template_id uuid not null references shift_templates(id), shift_code text not null,
  post_id uuid not null references posts(id), post_name text,
  facility_id uuid not null references facilities(id),
  date date not null, actual_start timestamptz not null, actual_end timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','in_progress','completed','cancelled','no_show')),
  is_published boolean not null default false,
  is_emergency_override boolean not null default false,
  override_reason text, approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
)
-- index: (date), (facility_id, date), (staff_id, date)

shift_requests(
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id), staff_name text not null,
  facility_id uuid not null references facilities(id),
  week_start date not null, date date not null,
  shift_template_id uuid not null references shift_templates(id), shift_code text not null,
  status text not null default 'draft' check (status in ('draft','submitted')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
)
-- index: (staff_id, week_start), (week_start, status)

employee_requests(
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id), staff_name text not null,
  type text not null check (type in ('vacation','sick_leave','reserve_duty','weapon_license','health','other')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  start_date date, end_date date,
  file_url text, file_name text,
  notes text, manager_comment text, handled_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
)
-- index: (staff_id, created_at desc), (created_at desc)

staffing_requirements(
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),   -- normalized from Base44's facility_code
  day_group text not null check (day_group in ('weekday','friday','saturday')),
  category text not null check (category in ('morning','afternoon','night')),
  supervisor integer not null default 0, guard integer not null default 0, dispatcher integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (facility_id, day_group, category)
)

system_config(
  id uuid primary key default gen_random_uuid(),
  key text not null unique, value text not null, description text,
  category text not null check (category in ('shift_limits','staffing_rules','emergency')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
)
```

`applicable_roles text[]` stays a native Postgres array (always read whole, filtered with `= ANY(...)`). `gen_random_uuid()` (pgcrypto, enabled by default in Supabase) replaces the earlier plan's client-side UUID generation.

**Storage** — one bucket, created in the same migration:

```sql
insert into storage.buckets (id, name, public)
values ('employee-request-attachments', 'employee-request-attachments', false);
```

Access policies for this bucket are defined in §B.3 alongside the table RLS policies, using the same role claim.

### B.3 Role-based access control (RLS + Supabase custom claims)

Supabase's recommended RBAC pattern, applied uniformly to both the Database and Storage: project `staff.access_level` into the JWT as a custom claim at token-issuance time (a **Supabase Auth Hook**), so every RLS policy — on tables and on `storage.objects` alike — reads the role straight off `auth.jwt()` with no per-check subquery.

```sql
-- Auth Hook: "Customize Access Token" — must also be wired up in the Supabase
-- dashboard under Authentication > Hooks, pointing at this function. That
-- dashboard step is manual; it isn't something a SQL migration can express.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  role_for_user public.app_role;
begin
  select access_level into role_for_user
  from public.staff
  where user_id = (event ->> 'user_id')::uuid;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{user_role}', to_jsonb(coalesce(role_for_user, 'no_access'::public.app_role)));

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
```

RLS policies then read `(auth.jwt() ->> 'user_role')` directly:

- **Reference data** (`facilities`, `posts`, `shift_templates`, `staffing_requirements`, `system_config`): `SELECT` for any authenticated user where `(auth.jwt() ->> 'user_role') <> 'no_access'`; `INSERT`/`UPDATE`/`DELETE` restricted to `(auth.jwt() ->> 'user_role') = 'admin'`.
- **`staff`**: `SELECT` for `admin`/`scheduler` (all rows) or `user_id = auth.uid()` (own row); write restricted to `admin`.
- **`shift_assignments`**: `SELECT` for `admin`/`scheduler` (all rows) or `staff_id in (select id from staff where user_id = auth.uid()) and is_published = true` (employee's own published shifts only, mirrors `ROUTE_ACCESS`'s published-schedule-only visibility for employees); write restricted to `admin`/`scheduler`.
- **`shift_requests`** / **`employee_requests`**: `SELECT`/`INSERT` own rows (`staff_id` matches the caller's staff record) for any role with a staff record; `admin`/`scheduler` can additionally read/update all rows (review/approval flow).
- **`staff_credential_notification_state`**: no policies for authenticated roles (default-deny) — only ever touched by the cron Route Handler using the Supabase **service-role key**, which bypasses RLS entirely.
- **`storage.objects`** (the `employee-request-attachments` bucket): upload restricted to the caller's own folder; read allowed for the caller's own folder or `admin`/`scheduler`:

  ```sql
  create policy "users upload own attachments"
    on storage.objects for insert
    with check (
      bucket_id = 'employee-request-attachments'
      and (storage.foldername(name))[1] = auth.uid()::text
    );

  create policy "own or admin/scheduler read attachments"
    on storage.objects for select
    using (
      bucket_id = 'employee-request-attachments'
      and (
        (storage.foldername(name))[1] = auth.uid()::text
        or (auth.jwt() ->> 'user_role') in ('admin', 'scheduler')
      )
    );
  ```

  Files are keyed `{user_id}/{filename}` on upload from the client, which is what `storage.foldername(name)` matches against.

No custom Postgres RPC functions are needed for this app's scale beyond the auth hook above — bulk operations (publish a week's assignments, submit draft requests, cancel conflicting shifts) go through the Supabase JS client's `.update().in('id', ids)` pattern from a Server Action, a single atomic `UPDATE ... WHERE id = ANY(...)` statement already.

**Claim staleness**: a role change made by an admin only reaches the affected user's JWT at their next token refresh (Supabase access tokens are short-lived, ~1hr, refreshed automatically in the background) or next login — not instantly. Acceptable for this app (permission changes aren't emergency-revocations); if instant effect is ever needed for a specific action, call `supabase.auth.refreshSession()` right after the change, but don't build that in until it's actually asked for.

### B.4 Auth

- Supabase Auth (email/password), wired into Next.js via `@supabase/ssr` (cookie-based sessions, works across Server Components/Route Handlers/`proxy.ts`).
- **Admin-only provisioning**, matching the closed-HR-system model: a Server Action running server-side (using the Supabase **service-role key**, never sent to the client) calls `supabase.auth.admin.createUser()`, then inserts/links the corresponding `staff` row (`user_id` = the new auth user's id). No public self-signup.
- `proxy.ts` refreshes the session cookie on every request and can redirect unauthenticated users; per-route UI gating should mirror the old app's `ROUTE_ACCESS` map (`git show main:src/lib/routePermissions.js` for the original — see `CLAUDE.md`) ported to the new app, reading `user_role` off the session's JWT claims rather than a separate query — but the **real** enforcement is RLS (§B.3), UI gating is for user experience, not security.
- Registering the Auth Hook (§B.3) is a **manual, one-time dashboard step** per Supabase project (dev, staging, prod each need it done separately) — note this explicitly in the Phase 0 checklist so it isn't missed when a new environment is spun up.

### B.5 Background jobs & notifications

- **Credential expiry check** — `web/app/api/cron/check-credential-expiries/route.ts`, triggered by **Vercel Cron** (`web/vercel.json`: `{"crons":[{"path":"/api/cron/check-credential-expiries","schedule":"0 6 * * *"}]}`). Protect the route by checking a shared secret header Vercel Cron sends (`CRON_SECRET` env var) so it can't be publicly invoked. **Timezone note**: Vercel Cron schedules are UTC-only, no IANA timezone support — `0 6 * * *` UTC ≈ 08:00 Israel Standard Time (winter, UTC+2) but 09:00 during Israel Daylight Time (summer, UTC+3). Recommend accepting the ~1hr seasonal drift with a fixed UTC schedule rather than building DST-aware gating into the route handler — this is a low-stakes daily reminder, not worth the complexity. Direct port of `checkCredentialExpiries` logic (bucket/state-machine, per-staff email) into TypeScript, using the service-role Supabase client to read/write `staff` and `staff_credential_notification_state`.
- **`notifyEmployeeRequest`** / **`notifySchedulePublished`** — called from the relevant Server Action right after the DB write commits. Use `after()` (from `next/server`) to run the Slack POST after the response is returned to the user, so a slow/down Slack never adds latency to (or blocks) the user-facing action.
- **Slack**: keep it to a single incoming webhook (`lib/slack.ts`, reads `SLACK_WEBHOOK_URL`, posts to the channel the webhook is bound to) — same reasoning as the earlier plan: this app only ever posts to one configured channel, so Base44's OAuth bot connector (multi-scope, multi-channel) has no functional advantage here.
- **Email** (credential expiry reminders): recommend **Resend** — TypeScript-first SDK, minimal setup, fits the Vercel/Next.js ecosystem well. Needs an account + verified sending domain + API key (`RESEND_API_KEY`) — a Phase 0 provisioning dependency, not a code blocker.
- **File uploads** (`EmployeeRequest` attachments, replacing Base44's `integrations.Core.UploadFile`): the `employee-request-attachments` Storage bucket and its policies are defined in §B.2/§B.3 — this phase is just the `EmployeeRequestForm` component port to call `supabase.storage.from(...).upload(...)`.

### B.6 Build order / phases (big-bang: build the full app, cut over once)

**Phase 0 — foundations (~day 1, shared):** create the Supabase Cloud dev project; scaffold `/web` (`create-next-app`, TypeScript, App Router, Tailwind); write the full schema + storage bucket + RLS policies + the `custom_access_token_hook` function as one Supabase migration (one dev writes, the other reviews); **register the Auth Hook in the Supabase dashboard** (Authentication > Hooks — manual step, not part of the SQL migration); regenerate shadcn/ui components into `web/components/ui/`; set up `@supabase/ssr`/`@supabase/supabase-js` and env vars; start Resend account provisioning in parallel.

**Phase 1 — auth + reference data (parallel):** Dev B → Supabase Auth wiring (`@supabase/ssr` client, `proxy.ts`, login/logout pages, admin user-provisioning Server Action) — Supabase Auth is managed, so unlike a custom JWT service there's no long lead time blocking Dev A; seed a test admin user directly via the Supabase dashboard/CLI to unblock parallel work immediately. Dev A → `facilities` + `posts` pages/components ported into `/web`, establishing the React-Query-+-Supabase-client pattern the rest of the app copies.

**Phase 2 — core entity pages (parallel, bulk of the work):** Dev A → `staff`, `shift-templates`, `staffing-requirements`, `system-config` pages/components. Dev B → `shift-assignments` (schedule board, smart-schedule) and `shift-requests` pages/components. Same dependency note as before: `shift_assignments` pages need `staff`/`posts`/`shift_templates`/`facilities` data to be meaningfully testable, so Dev B can build against seed data while waiting on Dev A's pieces to land.

**Phase 3 — business logic (mostly Dev B):** weekly-hours Route Handler (port of `calculateWeeklyHours`, plain Supabase query + TS aggregation, no RPC needed) and its panel component; bulk-publish/bulk-submit/bulk-cancel flows via chained `.update().in()` calls in Server Actions; date-range schedule queries (`.gte('date', from).lte('date', to)` in one call, replacing the per-day-loop pattern the current frontend uses).

**Phase 4 — notifications & cron (parallel with Phase 3, other dev):** `lib/slack.ts`, the two notify Server Action call sites (with `after()`), the credential-expiry cron route + `vercel.json` config, Resend integration, Supabase Storage bucket + the file-upload component port (`EmployeeRequestForm`).

**Phase 5 — remaining pages + cutover:** port the remaining pages (`Dashboard`, `PublishedSchedulePage`, `UnstaffedShiftsPage`, `ConstraintsReportPage`, `MyAreaPage`, `RequestsManagementPage`, `EmployeeRequestsPage`, `SettingsPage`), split by ownership mirroring earlier phases — use `git show main:src/pages/<Page>.jsx` (etc.) to check the original implementation for any page whose exact behavior isn't already captured in `docs/MIGRATION_PLAN.md`/`architecture/DOMAIN_MODEL.md`. Data-migration dry run: a one-off `scripts/migrate-base44-export.ts` reading a Base44 data export and inserting into Supabase, handling the `expiry_notified` → `staff_credential_notification_state` expansion, `facility_code` → `facility_id` resolution, and preserving original Base44 `id`/`created_at` values on insert (Supabase's `gen_random_uuid()` default doesn't prevent supplying explicit ids) so cross-entity relationships survive. Run against the dev/staging Supabase project, deploy `/web` to a Vercel preview pointed at it, manually walk every page comparing against the **live Base44-hosted app** (base44.com — the old `src/` checkout is no longer in this repo, see the revision note at the top of this doc) before scheduling production cutover.

**Phase 6 — decommission:** once cutover is verified and stable through one full schedule cycle, retire `architecture/CURRENT_ARCHITECTURE.md`'s "current" framing (it now describes a decommissioned app) and cancel/archive the Base44 project itself. The `@base44/sdk` dependency and `src/` app are already gone from this branch; `main`/`develop` retain them in history if a rollback reference is ever needed.

### B.7 Testing & CI

- **Vitest** for unit tests (Route Handlers, utility/business-logic functions like the weekly-hours calculation and the credential-expiry bucket/state-machine logic).
- Rewrite `.github/workflows/ci.yml` for Node/TypeScript: `npm ci` in `web/`, `tsc --noEmit`, `eslint`, `vitest run` — drop the Python-specific steps entirely.
- A dedicated Supabase project (or database branch, if your plan tier supports it) for CI/test runs is worth setting up once Phase 1 is underway — not a Phase 0 blocker, revisit when the test suite has enough to actually run against real RLS policies.
- Pre-cutover verification is the manual page-by-page walk described in Phase 5, not an automated parity suite — proportionate to this app's size and the one-time nature of the cutover.

---

## First concrete steps

1. Create the Supabase Cloud dev project.
2. Scaffold `/web` with `create-next-app` (TypeScript, App Router, Tailwind).
3. Write the Phase 0 schema + storage bucket + RLS + auth-hook migration (§B.2, §B.3) and apply it via `supabase db push`.
4. Register the `custom_access_token_hook` Auth Hook in the Supabase dashboard (manual step).
5. Regenerate shadcn/ui components into `web/components/ui/`.
6. Start Resend account provisioning (not code-blocking).
7. Create GitHub issues for Phase 0/Phase 1 work items.
