-- =============================================================================
-- ONE-TIME RESET — drops the old single-tenant GuardSync schema.
--
-- This project previously ran web/'s direct-Supabase schema (enum-based
-- access_level, a custom_access_token_hook Auth Hook, JWT-claim RLS). It's
-- being reused as this app's dev tenant instead of provisioning a fresh
-- project. Confirmed before this ran: only a seeded test admin exists, no
-- real staff/facilities/shift data — see the conversation this migration
-- came out of, not repeated here since this file outlives that context.
--
-- CASCADE on every DROP: takes policies, indexes, triggers and FK
-- constraints referencing each object with it, so table drop order doesn't
-- need to hand-follow the FK graph.
--
-- Deliberately NOT touching auth.users — existing logins are preserved. The
-- baseline migration right after this one adds public.users; the previously
-- seeded admin gets a matching row seeded separately, referencing their
-- existing auth.users id, so they can log back in with the same credentials.
--
-- Timestamped BEFORE the baseline (20260101000000) so it runs first and
-- only once, on this one project. Never copy this file's approach into a
-- fresh project's migration history — a new project has nothing to reset.
-- =============================================================================

DROP TABLE IF EXISTS public.shift_assignments CASCADE;
DROP TABLE IF EXISTS public.shift_requests CASCADE;
DROP TABLE IF EXISTS public.employee_requests CASCADE;
DROP TABLE IF EXISTS public.staffing_requirements CASCADE;
DROP TABLE IF EXISTS public.staff_credential_notification_state CASCADE;
DROP TABLE IF EXISTS public.posts CASCADE;
DROP TABLE IF EXISTS public.shift_templates CASCADE;
DROP TABLE IF EXISTS public.staff CASCADE;
DROP TABLE IF EXISTS public.facilities CASCADE;

DROP FUNCTION IF EXISTS public.custom_access_token_hook(jsonb) CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- The old 'employee-request-attachments' bucket (Shift7 reuses the
-- platform's generic 'documents' bucket instead — see
-- 20260104000000_shift7_baseline.sql) is deliberately left in place: Supabase
-- rejects direct SQL writes to storage.buckets ("Direct deletion from storage
-- tables is not allowed. Use the Storage API instead."). It's just an unused,
-- empty bucket — harmless to leave; remove it by hand via the dashboard or
-- the Storage API if it matters later.
