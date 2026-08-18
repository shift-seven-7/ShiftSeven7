-- =============================================================================
-- Lock down the migration tracking table.
--
-- The baseline created public._applied_migrations without RLS, which leaves it
-- readable AND writable by the `anon` role — the key that ships in every
-- browser on the tenant's subdomain. Nothing secret is stored there, but an
-- anonymous caller could insert filenames to make pending migrations look
-- applied, or delete rows to make applied ones re-run.
--
-- Only the service role touches this table: the sync script and the
-- provisioning wizard both connect with it.
--
-- A NEW file rather than an edit to the baseline — that one has already run on
-- existing databases, so an edit would reach new tenants and never reach them.
-- =============================================================================

ALTER TABLE public._applied_migrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applied_migrations_service_role_only" ON public._applied_migrations;
CREATE POLICY "applied_migrations_service_role_only" ON public._applied_migrations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
