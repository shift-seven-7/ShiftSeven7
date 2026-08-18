-- =============================================================================
-- tenants.secrets — a general-purpose encrypted bag
--
-- WHY
-- Until now exactly two values were encrypted at rest: the tenant's Supabase
-- anon and service-role keys. Everything else a tenant might need to store
-- went into `settings`, which is plaintext JSONB.
--
-- That was fine while `settings` held a logo URL and a feature list. It stops
-- being fine the moment a project stores a per-tenant credential — an SMS
-- provider token for phone sign-in, a payment key, an integration secret. Those
-- would sit in the clear in every dump and backup of the master registry.
--
-- So: a second JSONB column whose VALUES are individually sealed with the same
-- AES-256-GCM envelope the key columns use, and the same key. `settings` stays
-- plaintext and stays readable; anything secret goes here.
--
-- SHAPE
--   { "<key>": "v1.<keyVersion>.<iv>.<ciphertext>" }
--
-- AAD is `<subdomain>:secret:<key>`, so a ciphertext cannot be moved to another
-- tenant's row, to another key name, or into one of the two credential columns
-- without failing to open. Read and written only through
-- getTenantSecret / setTenantSecret in lib/supabase/master-client.ts.
--
-- Rotation covers this column: npm run secrets:rotate.
-- =============================================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS secrets JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tenants.secrets IS
  'Per-tenant secrets. Each VALUE is an AES-256-GCM envelope with AAD '
  '"<subdomain>:secret:<key>". Never store a plaintext secret here — use '
  'setTenantSecret(). Non-secret configuration belongs in `settings`.';
