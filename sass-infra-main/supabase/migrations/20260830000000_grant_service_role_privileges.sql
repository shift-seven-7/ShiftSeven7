-- =============================================================================
-- Grant standard Supabase role privileges on the public schema.
--
-- None of the tenant migrations issue a base GRANT anywhere - on a hosted
-- Supabase project that's covered by platform-level default privileges set up
-- automatically when the project is provisioned, but a fresh local stack
-- (`supabase start`) has no such thing pre-configured. Every table access
-- (even from service_role, which bypasses RLS but still needs the underlying
-- GRANT) fails with "permission denied for table X" until this runs.
--
-- Every table in this schema already has its own RLS policies deciding what
-- anon/authenticated can actually see or write - these grants only remove the
-- privilege-layer block underneath those policies, matching the hosted
-- platform's default behaviour. service_role bypasses RLS entirely as usual.
--
-- ALTER DEFAULT PRIVILEGES covers tables created by migrations that run after
-- this one too, so this shouldn't need repeating.
-- =============================================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
