# שיפט7 (Shift7)

## Overview

Shift-scheduling for security staff — guards and dispatchers, across one or
more facilities, each with static posts and/or a control room. Covers the
staff roster, shift templates, weekly scheduling (drag-and-drop assignment,
publishing), employee self-service (availability requests, leave/absence
requests), coverage-gap and constraints reporting, and a credential-expiry
reminder cron.

**Two independent role layers**, not one:

| Layer | Column | Values | Scope |
|---|---|---|---|
| Platform | `public.users.app_role` | `ADMIN`, `SYSTEM_MANAGER`, `STAFF` | Whether you can sign in at all, and reach `/app/shift7` — see [users.md](users.md) |
| Shift7 module | `public.staff.access_level` | `admin`, `scheduler`, `employee`, `no_access` | What you can actually do *inside* the module |

A Shift7 user's platform `app_role` is almost always `STAFF` — a placeholder
that exists only so login/approval gating has something to check (see
`types/roles.ts`). The two layers are read by separate SQL functions and
never cross-reference each other except in one bootstrap route (see Design
notes). A tenant's own `ADMIN`/`SYSTEM_MANAGER` can also hold a `staff` row
(e.g. a קב"ט who is also the tenant's platform admin) — nothing prevents it,
but nothing implies it either.

**`SYSTEM_MANAGER` is scoped to its module(s) the same as `STAFF`.**
`HOME_PAGES.SYSTEM_MANAGER` is `/app/shift7`, and `ROUTE_PERMISSIONS['/app/home']`
/ `['/app/users']` are `ADMIN`-only (`lib/constants/permissions.ts`), so a Shift7
קב"ט/scheduler invited as `SYSTEM_MANAGER` (rather than provisioned through
Shift7's own "create login" flow as `STAFF`) gets the identical outer-platform
experience: only the "Shift7" sidebar item, no platform Home/Users/Settings
links. Only `ADMIN` reaches the full platform console. This is a deliberate,
revisitable choice — see the comment beside `ADMIN_ONLY` in
`lib/constants/permissions.ts`: it repurposes `SYSTEM_MANAGER`'s normally
generic, multi-tenant "manage users and settings" meaning platform-wide, which
only makes sense while every tenant here is Shift7-only.

## User Roles & Access

**Reaching the module at all**: `ROUTE_PERMISSIONS['/app/shift7'] =
ALL_INCLUDING_STAFF` (`lib/constants/permissions.ts`) — any signed-in,
approved user (`ADMIN`, `SYSTEM_MANAGER`, or `STAFF`) may open `/app/shift7`.
Also gated behind the `shift7` feature flag (`FEATURE_KEYS.SHIFT7`,
`lib/constants/features.ts`) — a tenant that hasn't enabled the module can't
reach it regardless of role.

**Inside the module**, `staff.access_level` decides everything, enforced by
`current_shift7_role()` / `is_shift7_admin()` / `is_shift7_scheduler_or_admin()`
(SQL, `SECURITY DEFINER`, defined in `20260104000000_shift7_baseline.sql`):

| Capability | admin | scheduler | employee | no_access |
|---|---|---|---|---|
| See own profile / my-area, upcoming shifts | ✅ | ✅ | ✅ | ❌ |
| Submit shift-request availability / leave requests | ✅ | ✅ | ✅ | ❌ |
| View published schedule (own shifts) | ✅ | ✅ | ✅ | ❌ |
| Add/edit/delete staff (non-admin rows) | ✅ | ✅ | ❌ | ❌ |
| Add/edit/delete a staff row with `access_level: 'admin'` | ✅ | ❌ | ❌ | ❌ |
| Grant `access_level: 'admin'` to anyone | ✅ | ❌ | ❌ | ❌ |
| Manage facilities, posts, shift templates, staffing requirements, system config | ✅ | ❌ | ❌ | ❌ |
| Schedule/edit/delete shift assignments, publish schedule | ✅ | ✅ | ❌ | ❌ |
| Review/approve/reject employee requests | ✅ | ✅ | ❌ | ❌ |
| `/app/shift7/settings` (module-wide settings + facility CRUD) | ✅ | ❌ | ❌ | ❌ |

`no_access` (or no `staff` row at all) sees nothing — `app/app/shift7/layout.tsx`
returns an empty nav and the page itself renders either the bootstrap card
(see Design notes) or a "no permission" message.

Nav visibility (`app/app/shift7/layout.tsx`) mirrors this table exactly —
`admin` sees `ADMIN_SCHEDULER_NAV + ADMIN_ONLY_NAV` (adds Settings),
`scheduler` sees `ADMIN_SCHEDULER_NAV` only, `employee` sees the 4-item
`EMPLOYEE_NAV`. **This is UX only** — every route above is independently
enforced server-side by the RPC checks and by RLS.

## Pages & Routes

All under `/app/shift7/*`, wrapped by the shared `layout.tsx` nav rail.

| Route | Purpose | Who sees it in nav |
|---|---|---|
| `/app/shift7` | Dashboard — stat tiles (active staff, posts, pending requests, facilities); redirects `employee` access to my-area, shows the bootstrap card when the caller has no `staff` row yet | admin, scheduler |
| `/app/shift7/staff` | Staff roster — list, search, create/edit/delete, create-login | admin, scheduler |
| `/app/shift7/shift-templates` | Shift template CRUD (code, times, category, color, applicable roles) | admin, scheduler |
| `/app/shift7/smart-schedule` | Drag-and-drop weekly assignment matrix, per facility or global, with rest-period validation | admin, scheduler |
| `/app/shift7/published-schedule` | Read-only, published-only schedule view; PDF/CSV export; every role reaches this (RLS narrows an employee to their own rows) | everyone with a staff row |
| `/app/shift7/unstaffed-shifts` | Coverage-gap report: staffing requirement vs. actual assignments, per category/day | admin, scheduler |
| `/app/shift7/staffing-requirements` | Minimum-coverage matrix per facility × day-group × shift category | admin, scheduler |
| `/app/shift7/manage-requests` | Approve/reject employee requests (leave, reserve duty, etc.) | admin, scheduler |
| `/app/shift7/constraints-report` | Cross-references submitted `shift_requests` against actual `shift_assignments` to surface conflicts | admin, scheduler |
| `/app/shift7/posts` | Static post / control-room post CRUD, per facility | admin, scheduler |
| `/app/shift7/settings` | Module-wide config (shift-hour limits, emergency mode, Slack channel) + facility CRUD | admin only |
| `/app/shift7/my-area` | Employee home: profile card, credential expiry status, upcoming shifts | employee |
| `/app/shift7/shift-request` | Submit weekly availability (pick one shift template per day, then submit the week) | employee |
| `/app/shift7/requests` | Submit and track leave/absence/reserve-duty/etc. requests, with file attachment | employee |

## API Endpoints

All under `/api/shift7/*`. `requireApproved(auth)` is the platform-level gate
on every route below; the "Auth" column names the *additional* Shift7-level
check. RLS independently backs every one of these — see Data Model.

**Staff**
| Endpoint | Method | Auth |
|---|---|---|
| `/api/shift7/staff` | GET | any approved user (RLS narrows non-admin/scheduler to their own row) |
| `/api/shift7/staff` | POST | `admin` or `scheduler` (`current_shift7_role()`) |
| `/api/shift7/staff/[id]` | GET | any approved user |
| `/api/shift7/staff/[id]` | PATCH / DELETE | `admin` or `scheduler`; scheduler blocked from admin-level rows |
| `/api/shift7/staff/[id]/create-login` | POST | `admin` or `scheduler`; scheduler blocked for admin-level rows |
| `/api/shift7/bootstrap` | GET / POST | platform `isAdmin()` (ADMIN/SYSTEM_MANAGER) — see Design notes |

**Reference data** (facilities, posts, shift templates, staffing requirements, system config)
| Endpoint | Method | Auth |
|---|---|---|
| `/api/shift7/facilities` | GET | any approved user |
| `/api/shift7/facilities` | POST | `is_shift7_admin()` |
| `/api/shift7/facilities/[id]` | PATCH / DELETE | `is_shift7_admin()` |
| `/api/shift7/posts` | GET | any approved user |
| `/api/shift7/posts` | POST | `is_shift7_admin()` |
| `/api/shift7/posts/[id]` | PATCH / DELETE | `is_shift7_admin()` |
| `/api/shift7/shift-templates` | GET | any approved user |
| `/api/shift7/shift-templates` | POST | `is_shift7_admin()` |
| `/api/shift7/shift-templates/[id]` | PATCH / DELETE | `is_shift7_admin()` |
| `/api/shift7/staffing-requirements` | GET | any approved user |
| `/api/shift7/staffing-requirements` | POST (upsert) | `is_shift7_admin()` |
| `/api/shift7/system-config` | GET | any approved user |
| `/api/shift7/system-config` | POST (upsert) | `is_shift7_admin()` |

**Scheduling**
| Endpoint | Method | Auth |
|---|---|---|
| `/api/shift7/shift-assignments` | GET (date range, optional facility/staff) | any approved user (RLS narrows) |
| `/api/shift7/shift-assignments` | POST | `is_shift7_scheduler_or_admin()` |
| `/api/shift7/shift-assignments/[id]` | PATCH / DELETE | `is_shift7_scheduler_or_admin()` |
| `/api/shift7/shift-assignments/mine` | GET | any approved user with a `staff` row — own upcoming published shifts |
| `/api/shift7/shift-assignments/publish` | POST | `is_shift7_scheduler_or_admin()` — bulk-sets `is_published`, fires Slack notification |

**Employee self-service**
| Endpoint | Method | Auth |
|---|---|---|
| `/api/shift7/shift-requests` | GET (own, or `?scope=all` for scheduler/admin) | any approved user; `scope=all` needs `is_shift7_scheduler_or_admin()` |
| `/api/shift7/shift-requests` | POST | any approved user with a `staff` row — one row per day, replaces existing |
| `/api/shift7/shift-requests/[id]` | DELETE | RLS-scoped to own rows |
| `/api/shift7/shift-requests/submit` | POST | marks the caller's own `draft` rows for a week as `submitted` |
| `/api/shift7/employee-requests` | GET (own, or `?scope=all`) | any approved user; `scope=all` needs `is_shift7_scheduler_or_admin()` |
| `/api/shift7/employee-requests` | POST | any approved user with a `staff` row |
| `/api/shift7/employee-requests/[id]` | PATCH | two shapes: `{ notes }` self-edit (own, `pending` only) vs. `{ status, manager_comment }` decision (`is_shift7_scheduler_or_admin()`) — never the same call |
| `/api/shift7/employee-requests/[id]` | DELETE | RLS-scoped to own, still-`pending` rows |

**Reports & cron**
| Endpoint | Method | Auth |
|---|---|---|
| `/api/shift7/reports/weekly-hours` | GET | any approved user (RLS thins the aggregate for a plain employee, not a separate check) |
| `/api/shift7/cron/check-credential-expiries` | GET | `CRON_SECRET` bearer token (if set); fans out across every active tenant with the `shift7` feature enabled |

## Data Model

All in `supabase/migrations/20260104000000_shift7_baseline.sql`, RLS enabled
on every table.

| Table | Key columns | Notes |
|---|---|---|
| `facilities` | `id`, `name`, `code` (unique), `address`, `status` | |
| `staff` | `id`, `user_id` (nullable FK → `auth.users`, **unique when set**), `full_name`, `employee_id` (unique), `role` (`guard`\|`dispatcher`), `qualification`, `primary_facility` (FK), `access_level`, credential expiry dates | `user_id` is nullable **by design** — most staff rows have no login at all. `current_shift7_role()` reads `access_level` where `user_id = auth.uid() AND status = 'active'` |
| `staff_credential_notification_state` | `(staff_id, credential_key)` PK, `state` | RLS enabled, **no policies** — only the cron's service-role client ever touches it (default-deny for every client role) |
| `posts` | `id`, `name`, `code`, `type` (`static`\|`control_room`), `facility` (FK), `required_role` | unique on `(facility, code)` |
| `shift_templates` | `id`, `code`, `name`, `category` (`morning`\|`afternoon`\|`night`), `start_time`, `end_time`, `duration_hours`, `applicable_roles[]`, `facility` (nullable FK — `null` = global template), `color` | |
| `shift_assignments` | `id`, `staff_id`, `shift_template_id`, `post_id`, `facility_id`, `date`, `actual_start/end`, `status`, `is_published`, `is_emergency_override`, `approved_by` | the schedule itself |
| `shift_requests` | `id`, `staff_id`, `week_start`, `date`, `shift_template_id`, `status` (`draft`\|`submitted`) | employee's own weekly availability picks |
| `employee_requests` | `id`, `staff_id`, `type` (vacation/sick/reserve/weapon-license/health/other), `status` (`pending`\|`approved`\|`rejected`), `start/end_date`, `notes`, `manager_comment`, `handled_by` | attachment (if any) lives in the platform's shared `public.files` registry, bucket `documents`, not a Shift7-specific table |
| `staffing_requirements` | `id`, `facility_id`, `day_group` (`weekday`\|`friday`\|`saturday`), `category`, `supervisor`/`guard`/`dispatcher` counts | unique on `(facility_id, day_group, category)`; drives the unstaffed-shifts report |
| `system_config` | `id`, `key` (unique), `value`, `category` (`shift_limits`\|`staffing_rules`\|`emergency`) | free-form key/value, e.g. `max_shift_hours`, `emergency_mode`, `slack_notification_channel` |

**RLS helper functions** (`SECURITY DEFINER`, pinned `search_path`):
- `current_shift7_role()` — live `SELECT access_level FROM staff WHERE user_id = auth.uid() AND status = 'active'`
- `is_shift7_admin()` — `current_shift7_role() = 'admin'`
- `is_shift7_scheduler_or_admin()` — `current_shift7_role() IN ('admin', 'scheduler')`

Same pattern as the platform's own `current_app_role()`/`is_admin()` — a
fresh table read on every check, not a JWT claim. See
[multi-tenant.md](../multi-tenant.md) for why this repo doesn't use an Auth
Hook.

## Hooks

All in `hooks/queries/`, following the `tanstack-query` skill.

| Hook file | Covers |
|---|---|
| `useShift7Staff.ts` | list/create/update/delete staff, `useCreateShift7StaffLogin` |
| `useMyShift7Staff.ts` | the caller's own `staff` row ("who am I in Shift7") |
| `useShift7Facilities.ts` | read-only facility list |
| `useShift7FacilitiesAdmin.ts` | facility create/update/delete (settings page) |
| `useShift7Posts.ts` | post list/create/update/delete |
| `useShift7ShiftTemplates.ts` | template list/create/update/delete |
| `useShift7ShiftAssignments.ts` | assignment list (range/facility/staff), create, publish |
| `useMyShift7UpcomingShifts.ts` | caller's own upcoming published shifts (my-area) |
| `useShift7ShiftRequests.ts` | own/all weekly availability picks, select/delete/submit |
| `useShift7EmployeeRequests.ts` | own/all leave-type requests, create, decide (approve/reject) |
| `useShift7StaffingRequirements.ts` | coverage matrix read + upsert |
| `useShift7SystemConfig.ts` | config read + upsert |
| `useShift7Bootstrap.ts` | bootstrap status + the one-time self-onboarding mutation |

## Key Files

- `app/app/shift7/layout.tsx` — the module's own nav rail; encodes the exact
  role→page visibility table above
- `app/app/shift7/staff/page.tsx` — staff roster, the reference
  implementation for the rest of the module's CRUD pages
- `app/api/shift7/staff/[id]/create-login/route.ts` — creates a login for an
  existing staff row (ported from `web/src/app/actions/auth.ts`'s
  `createStaffLogin`)
- `app/api/shift7/bootstrap/route.ts` — the chicken-and-egg fix, see below
- `components/features/shift7/BootstrapShift7Card.tsx` — the first-run UI
- `components/features/shift7/StaffFormDialog.tsx`,
  `DeleteStaffDialog.tsx`, `CreateStaffLoginDialog.tsx` — staff row actions
- `components/features/shift7/EmployeeRequestCard.tsx` — shared render for
  both the employee's own request list and the admin review queue
- `components/features/shift7/smart-schedule/WeeklyMatrix.tsx`,
  `ShiftCardsPanel.tsx` — the drag-and-drop scheduling grid (`@hello-pangea/dnd`)
- `lib/shift7/` — pure helpers: `staffingRequirements.ts` (shortage
  computation), `shiftValidation.ts` (rest-period check), `employeeRequests.ts`
  (request-type metadata), `exportSchedule.ts` (PDF/CSV), `notifications.ts`
  (Slack), `email.ts` (credential-expiry mail)

## Design notes

**Why `staff.access_level` is a separate column from `app_role`, not a
reuse of it.** The platform's role system (`ADMIN`/`SYSTEM_MANAGER`/`STAFF`)
is generic infrastructure with no knowledge of any module. Shift7 needs finer
granularity (`admin`/`scheduler`/`employee`/`no_access`) that has no meaning
outside the module, and a future module will want its own scheme too — see
the note in `types/roles.ts` on keeping domain roles out of the platform
file. `STAFF` exists purely so a Shift7 user's account can pass the
platform's login/approval gate at all.

**The bootstrap chicken-and-egg, and how it's solved.**
`is_shift7_admin()` requires an existing `staff` row with `access_level =
'admin'` — so on a freshly provisioned tenant, *nobody* can create the first
one through the normal staff-create route (which itself requires
`is_shift7_admin()`/`scheduler`). `app/api/shift7/bootstrap/route.ts` is the
one deliberate exception: it checks the **platform** role (`isAdmin(auth)` —
`ADMIN`/`SYSTEM_MANAGER`) instead, and lets that person create exactly one
`staff` row for themselves, hardcoded to `access_level: 'admin'`, with
`user_id` linked to their own already-existing login. A matching RLS policy
("shift7 platform admin bootstraps own staff row") backs this at the
database level too. The tenant provisioning wizard's own `admin_created`
step deliberately does **not** create anything in `staff` — it "doesn't and
shouldn't know Shift7 exists" (verbatim from the route's own comment) — so
every new tenant's first admin sees `BootstrapShift7Card` on first visit to
`/app/shift7` and must click through it once.

**Why staff creation never touches `public.users`.** `POST
/api/shift7/staff` inserts only into `staff`, with `user_id` left `null`.
Most staff rows are pure personnel records — name, role, license expiry
dates — created long before (or instead of) ever getting a login. A staff
member needs a platform login only once someone deliberately grants one.

**Why `create-login` mirrors `/api/users/invite`'s no-password convention,
not `web/`'s original `createStaffLogin` (which set a password directly).**
This repo's own generic invite flow already established the pattern:
`email_confirm: true`, no password, `invited_at` set, the person completes
setup via "forgot password". Reusing that convention here means one
account-creation mental model across the whole app instead of two. Ported
from `web/`'s design (see `web/docs/../docs/MIGRATION_PLAN.md` §B.4, "closed
HR system, admin-only provisioning"), adapted at this one specific point.

**Why a scheduler can manage staff but never touch an `admin`-level row.**
Enforced twice — in the route (`shift7Role === 'scheduler' && access_level
=== 'admin'` → forbidden) and independently in RLS ("shift7 schedulers write
non-admin staff" has `access_level <> 'admin'` in both `USING` and `WITH
CHECK`) — so privilege escalation fails even if a caller bypasses the route
entirely with a raw Supabase call. The same guard is applied to
`create-login` for consistency, even though it's a newer route.

**Why `staff_credential_notification_state` has RLS enabled but zero
policies.** Default-deny. Only the credential-expiry cron
(`/api/shift7/cron/check-credential-expiries`), running with a service-role
client per tenant, ever reads or writes it — no client role has any
legitimate reason to touch this table directly.

**Why the credential-expiry cron fans out across tenants itself, instead of
one cron job per tenant.** Vercel Cron only ever calls one URL — there's no
per-subdomain scheduling. The route calls `getActiveTenants()` and creates a
`createServiceClientForTenant()` per tenant with the `shift7` feature
enabled, keeping each tenant's data in its own client and never mixing rows
across tenants in one query.

**Why several source-app pages were deliberately not ported yet**
(a full drag-and-drop `Dashboard` widget set, `ProfileHeader`/
`MonthlyHoursChart` sub-components on my-area) — the current pages cover the
same underlying data through simpler, single-component implementations. Not
a regression; a scoping choice for this porting pass.

## Related

- [modules-and-roles.md](../modules-and-roles.md) — how a module and a
  platform role are added in general
- [features/users.md](users.md) — the platform-level `app_role` layer this
  module's `STAFF` role sits on top of
- [multi-tenant.md](../multi-tenant.md) — why RLS checks re-read tables live
  instead of trusting a JWT claim
