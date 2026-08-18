-- =============================================================================
-- TENANT DATABASE — baseline
--
-- Runs on EVERY tenant's own Supabase project. Applied by
-- `npm run sync-tenant-migrations`, by `npm run db:migrate` locally, and by the
-- `migrations_applied` step of the provisioning wizard.
--
-- Migrations are FILES. Nothing here is executed against a live database
-- without an explicit request — see the `migrations` skill.
--
-- Write every migration idempotently (IF NOT EXISTS, DROP POLICY before CREATE
-- POLICY, CREATE OR REPLACE FUNCTION): a tenant may be at any point in the
-- sequence when it is synced.
-- =============================================================================

-- ─── shared helpers ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- users
--
-- One row per auth.users row, holding the application-level role. Supabase's
-- auth schema is not extended directly so that RLS policies can join against a
-- table in `public`.
--
-- ── IDENTITY IS EITHER-OR ────────────────────────────────────────────────────
-- `email` is nullable and `phone` is unique, because the sign-in method is a
-- deployment choice (see lib/auth/methods.ts). A phone-OTP deployment produces
-- accounts that have never had an email address, and an email deployment
-- produces accounts with no phone. Requiring both, or requiring email
-- specifically, would hard-code one of those choices into the schema.
--
-- `users_identity_present` is what keeps a row from having neither.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT UNIQUE,
  full_name         TEXT,
  phone             TEXT UNIQUE,
  avatar_url        TEXT,

  -- NULL = signed up but not yet approved. That is the normal state for a
  -- self-registration; an admin assigns a role on the users page.
  app_role          TEXT,

  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  -- Created by an admin, has no credentials, cannot sign in.
  is_managed        BOOLEAN NOT NULL DEFAULT FALSE,
  -- Set when invited, cleared on first successful login.
  invited_at        TIMESTAMPTZ,

  -- Per-user module overrides: { "<featureKey>": boolean }.
  features_override JSONB NOT NULL DEFAULT '{}'::jsonb,

  theme_mode        TEXT,
  theme_color       TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- >>> THE ONLY DATABASE EDIT POINT WHEN ADDING A ROLE <<<
  -- Widen this list in a NEW migration; never edit this file in place.
  CONSTRAINT users_app_role_check
    CHECK (app_role IS NULL OR app_role IN ('ADMIN', 'SYSTEM_MANAGER')),

  -- A row with neither identifier could never sign in and could never be
  -- matched to an invitation.
  CONSTRAINT users_identity_present
    CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- `phone` needs no index of its own: UNIQUE already builds one.
CREATE INDEX IF NOT EXISTS idx_users_email    ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_users_app_role ON public.users (app_role);

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── role helpers for RLS ────────────────────────────────────────────────────
--
-- Every policy in the app goes through these two functions rather than
-- inlining a role list. Adding a role then touches the CHECK constraint above
-- and, at most, these functions — not dozens of policies.
--
-- SECURITY DEFINER with a pinned search_path: without it, reading public.users
-- from inside a policy ON public.users recurses.

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_role
  FROM public.users
  WHERE id = auth.uid()
    AND is_active
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_app_role() IN ('ADMIN', 'SYSTEM_MANAGER')
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Any signed-in user can see the directory. Revisit the moment a
-- low-privilege role is introduced — see the `roles-permissions` skill.
DROP POLICY IF EXISTS "users_select_all" ON public.users;
CREATE POLICY "users_select_all" ON public.users
  FOR SELECT TO authenticated
  USING (TRUE);

-- Self-registration: the auth callback inserts the caller's own row.
DROP POLICY IF EXISTS "users_insert_self" ON public.users;
CREATE POLICY "users_insert_self" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_self" ON public.users;
CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_admin_manage" ON public.users;
CREATE POLICY "users_admin_manage" ON public.users
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================================================
-- system_settings — tenant-scoped key/value configuration
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_settings_read" ON public.system_settings;
CREATE POLICY "system_settings_read" ON public.system_settings
  FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "system_settings_manage" ON public.system_settings;
CREATE POLICY "system_settings_manage" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================================================
-- tenant_feature_defaults — tenant-wide ON/OFF within the purchased package
--
-- Layer 2 of module resolution:
--   tenants.settings.features (master)  ∩  this table  ∩  users.features_override
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_feature_defaults (
  feature_key TEXT PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tenant_feature_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_defaults_read" ON public.tenant_feature_defaults;
CREATE POLICY "feature_defaults_read" ON public.tenant_feature_defaults
  FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "feature_defaults_manage" ON public.tenant_feature_defaults;
CREATE POLICY "feature_defaults_manage" ON public.tenant_feature_defaults
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================================================
-- files — upload registry
--
-- Storage objects live in Supabase Storage; this table is the queryable index
-- over them (who uploaded what, attached to which entity).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size          INTEGER NOT NULL,
  bucket        TEXT NOT NULL,
  path          TEXT NOT NULL,
  url           TEXT NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- e.g. 'avatar', 'tenant_logo'. Modules add their own values.
  entity_type   TEXT,
  entity_id     UUID,
  width         INTEGER,
  height        INTEGER,
  is_public     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_entity ON public.files (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_files_user   ON public.files (user_id);

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "files_select" ON public.files;
CREATE POLICY "files_select" ON public.files
  FOR SELECT TO authenticated
  USING (is_public OR auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "files_insert_own" ON public.files;
CREATE POLICY "files_insert_own" ON public.files
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "files_modify_own" ON public.files;
CREATE POLICY "files_modify_own" ON public.files
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- =============================================================================
-- terms_acceptances — who accepted which version of the legal copy
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.terms_acceptances (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version     TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, version)
);

ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "terms_self" ON public.terms_acceptances;
CREATE POLICY "terms_self" ON public.terms_acceptances
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "terms_admin_read" ON public.terms_acceptances;
CREATE POLICY "terms_admin_read" ON public.terms_acceptances
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- migration tracking
--
-- The sync script creates this too; declaring it here keeps a hand-applied
-- database consistent with a synced one. The column is `filename` — the same
-- name scripts/sync-tenant-migrations.ts writes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public._applied_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
