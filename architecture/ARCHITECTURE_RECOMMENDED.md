# Recommended Architecture

## Goal

Rebuild GuardSync ("Secure Shift Flow") as a Next.js + Supabase application, deployed on Vercel, with no dependency on Base44. This supersedes the earlier FastAPI/Postgres/Redis/Celery plan — see `docs/MIGRATION_PLAN.md` for the full technical plan and rationale.

## High-Level Design

### Frontend

- Next.js (App Router, TypeScript strict) — a new app, built alongside the existing Vite/React app until cutover, not a conversion of it in place.
- `@tanstack/react-query` + the Supabase JS client for data fetching/mutations from Client Components — chosen over a Server-Components-first rewrite specifically to let most of the existing component logic (loading states, mutation patterns, forms) port over with minimal restructuring.
- Supabase Auth (`@supabase/ssr`) for session handling, replacing `AuthContext.jsx`'s Base44 client.
- Feature-organized modules mirroring the current app: scheduling, staff/facility management, shift requests, employee requests, configuration/settings, published schedule/dashboard.

### Backend: Supabase

Supabase replaces the entire custom backend (no FastAPI, no separately deployed services):

- **Postgres** — the primary datastore. Schema defined as versioned SQL migration files, applied via the Supabase CLI to a hosted Supabase Cloud project (no local Docker-based Supabase dev stack for now — see `docs/MIGRATION_PLAN.md` §A.1).
- **Row Level Security (RLS)** — the primary authorization boundary. Policies per table enforce who can read/write which rows (e.g. only admins write `staff`; employees only see their own `shift_requests`) directly at the database layer, rather than relying solely on application-level checks.
- **Supabase Auth** — issues sessions, replaces the custom JWT-issuing auth service from the earlier plan. `auth.users` is the login identity; the app's `staff` table stays a separate HR roster table linked via `staff.user_id`.
- **Supabase Storage** — file uploads (e.g. sick-note attachments on `EmployeeRequest`), replacing the earlier plan's local-disk-volume decision.
- **Next.js API routes / Server Actions** — application logic that doesn't belong in the database (weekly-hours report, Slack/email notifications) runs here, deployed with the frontend on Vercel. No separate notifications service, no Celery — see `docs/MIGRATION_PLAN.md` §B.4 for the background-job design (Vercel Cron replaces Celery Beat).

### Database

Same domain model as documented in `DOMAIN_MODEL.md` (Staff, Facility, Post, ShiftTemplate, ShiftAssignment, ShiftRequest, EmployeeRequest, StaffingRequirement, SystemConfig), implemented as Postgres tables with RLS policies instead of application-layer CRUD services. See `docs/MIGRATION_PLAN.md` §B.2 for the concrete schema.

## API Layer

No REST API layer in the FastAPI sense. Instead:

- **Direct Supabase queries** from Client Components (via React Query + the Supabase JS client) for simple CRUD, protected by RLS.
- **Postgres RPC functions** for multi-row/transactional operations that need atomicity (bulk-publish a schedule, bulk-submit shift requests, bulk-cancel conflicting assignments) — called via `supabase.rpc(...)`.
- **Next.js Route Handlers** for anything that needs a trusted server context or third-party calls: the weekly-hours report, the Slack notification calls, the daily credential-expiry cron job, admin user provisioning via the Supabase Admin API.

This isolates the frontend from raw SQL for simple cases while keeping business logic that needs a server (Slack calls, scheduled jobs, elevated-privilege admin actions) out of the browser.

## Service Boundaries (logical, not separate deployables)

There are no independently deployed backend services. "Service boundaries" here mean code organization within the one Next.js app plus the Supabase project:

- **Auth** — Supabase Auth + a `staff.user_id` link; admin-only user provisioning via a Route Handler using the Supabase Admin API (service-role key, server-only).
- **Staff / Facility / Post / Shift Template / Staffing Requirement / System Config** — direct Supabase table access from Client Components, RLS-protected.
- **Scheduling / Requests** — direct Supabase table access for simple reads/writes; RPC functions for bulk-publish, bulk-submit, bulk-cancel.
- **Notifications** — Route Handlers that post to Slack (webhook) and send email (see `docs/MIGRATION_PLAN.md` for provider choice), triggered from Server Actions right after a DB write, and from the Vercel Cron-triggered credential-expiry route.
- **Config** — `system_config` table, same RLS-protected direct access pattern.

## Workflow Examples

### Publish Schedule

1. Admin triggers publish from the frontend (Server Action or RPC call).
2. A Postgres RPC function sets `is_published = true` on the relevant `shift_assignments` rows in one transaction.
3. The Server Action then calls the notifications Route Handler (or posts directly), which sends the Slack message.

### Request Submission

1. Employee submits a shift request; RLS ensures they can only insert rows for their own `staff_id`.
2. Managers view pending requests via a Supabase query filtered to `status = 'submitted'`, RLS-permitted for admin/scheduler roles.
3. Approval updates request status (Server Action) and may trigger a Slack notification.

## Deployment

- **Vercel** — hosts the Next.js app (frontend + Route Handlers + Vercel Cron for scheduled jobs). No Docker, no container orchestration.
- **Supabase Cloud** — hosts Postgres, Auth, Storage. No self-managed database infrastructure.
- No `docker-compose.yml`, no self-hosted services — both platforms are managed.

## Why This Architecture

- Removes the Base44 dependency without taking on the operational overhead of self-hosting Postgres/Redis/Celery/multiple FastAPI services.
- RLS gives the database itself a security boundary, not just the application code.
- One deployable (the Next.js app) plus one managed backend platform (Supabase) is a small-team-appropriate footprint for this app's actual scale.
- Vercel Cron replaces Celery Beat for the one scheduled job this app needs (daily credential-expiry check), without standing up Redis/a worker process.

## File References

- `docs/MIGRATION_PLAN.md` — the full technical migration plan (schema, RLS policies, Route Handlers, phases).
- `CURRENT_ARCHITECTURE.md` — the current Base44-coupled state (still accurate until cutover).
- `DOMAIN_MODEL.md` — entity definitions (still accurate; implemented as Postgres tables per the migration plan).
