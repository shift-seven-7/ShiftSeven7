-- =============================================================================
-- Grant service_role table-level access to the registry.
--
-- 20260101000000_master_baseline.sql enabled RLS with a service_role-only
-- policy, but never issued a base GRANT - on a hosted Supabase project that's
-- covered by the platform's own default privileges, but a fresh local stack
-- (`supabase start`) doesn't have that pre-configured, so every read/write
-- fails with "permission denied for table tenants" even though RLS would
-- allow it. RLS filters rows; it never substitutes for the underlying grant.
-- =============================================================================

GRANT ALL ON public.tenants TO service_role;
GRANT ALL ON public._master_applied_migrations TO service_role;
