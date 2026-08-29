-- =============================================================================
-- MASTER REGISTRY — baseline
--
-- Applies to the MASTER Supabase project only (the one addressed by
-- MASTER_SUPABASE_URL). Tenant databases get supabase/migrations/ instead.
--
-- Apply with:  npm run sync-master-migrations
-- Never applied automatically, and never run by an agent without being asked.
--
-- The registry holds exactly one thing: how to reach each tenant. No user data,
-- no application tables. Tenant isolation here is physical — one Supabase
-- project per tenant — not row-level.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── identity ──────────────────────────────────────────────────────────────
  -- Immutable after creation: DNS records, OAuth redirect URLs, and the
  -- encryption AAD are all bound to it.
  subdomain                 TEXT UNIQUE NOT NULL,
  name                      TEXT NOT NULL,
  name_he                   TEXT,
  status                    TEXT NOT NULL DEFAULT 'active',

  -- ── the tenant's own Supabase project ─────────────────────────────────────
  supabase_project_ref      TEXT NOT NULL,
  supabase_url              TEXT NOT NULL,
  -- AES-256-GCM envelopes written by lib/crypto/secrets.ts:
  --   v1.<keyVersion>.<base64url iv>.<base64url ciphertext||tag>
  -- Plaintext values are still readable (decryptMaybe passes them through), so
  -- an existing registry can be encrypted in place with
  -- `npm run secrets:encrypt`.
  supabase_anon_key         TEXT NOT NULL,
  supabase_service_role_key TEXT NOT NULL DEFAULT '',
  secrets_key_version       SMALLINT NOT NULL DEFAULT 1,

  -- ── plan & limits ─────────────────────────────────────────────────────────
  plan_type                 TEXT NOT NULL DEFAULT 'standard',
  max_users                 INTEGER NOT NULL DEFAULT 25,
  storage_limit_gb          INTEGER NOT NULL DEFAULT 10,

  -- ── customisation (TenantSettings in types/tenant.types.ts) ───────────────
  --   logo_url, primary_color, custom_domain
  --   features: string[]        enabled module keys; absent = the whole registry
  --   terms_of_service, privacy_policy, terms_version
  settings                  JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- ── provisioning wizard state ─────────────────────────────────────────────
  -- { steps: { <step>: boolean }, admin_email, last_error, updated_at }
  setup_status              JSONB,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tenants_status_check
    CHECK (status IN ('active', 'suspended', 'pending', 'deleted')),
  CONSTRAINT tenants_plan_check
    CHECK (plan_type IN ('trial', 'standard', 'premium', 'enterprise')),
  -- Must be a valid DNS label: lowercase alphanumerics and inner hyphens.
  CONSTRAINT tenants_subdomain_format
    CHECK (subdomain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$')
);

-- The proxy's hot path: resolve an active tenant by subdomain.
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain_active
  ON public.tenants (subdomain)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants (status);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON public.tenants;
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Only the service role ever touches this table. There is no end-user path to
-- the registry: it is reached exclusively from server code holding
-- MASTER_SUPABASE_SERVICE_KEY.
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_service_role_only" ON public.tenants;
CREATE POLICY "tenants_service_role_only" ON public.tenants
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =============================================================================
-- Migration tracking
--
-- The column is `filename`, matching scripts/sync-master-migrations.ts exactly.
-- A mismatch here silently re-runs every migration on every sync.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public._master_applied_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public._master_applied_migrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "master_migrations_service_role_only"
  ON public._master_applied_migrations;
CREATE POLICY "master_migrations_service_role_only" ON public._master_applied_migrations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
