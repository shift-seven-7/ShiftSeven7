-- =============================================================================
-- SHIFT7 — module baseline
--
-- Shift-scheduling for security staff (guards, dispatchers, facilities,
-- posts). Ported from the standalone Shift7 app's own Supabase schema onto
-- this platform's conventions:
--   - staff.access_level is TEXT + CHECK, not a Postgres enum (matches
--     users.app_role's style; widening a CHECK is a plain migration).
--   - Role reads go through a SECURITY DEFINER helper (current_shift7_role,
--     mirroring current_app_role/is_admin), not a JWT custom claim — no Auth
--     Hook to register per environment, and no token-refresh staleness.
--   - Module tables only. Nothing here touches public.users, ROUTE_PERMISSIONS
--     or lib/constants/roles.ts — see 20260103000000_add_staff_role.sql for
--     the one platform-level change this module needed (the STAFF role).
--
-- Every guard/dispatcher/scheduler/admin distinction below is module-internal.
-- A Shift7 user's platform app_role is 'STAFF' (or 'ADMIN'/'SYSTEM_MANAGER'
-- for a manager who is also a platform admin); their real permission level is
-- staff.access_level, checked here and in app/api/shift7/* route handlers.
-- =============================================================================

-- ─── staff role helper ───────────────────────────────────────────────────────
--
-- SECURITY DEFINER with a pinned search_path: without it, reading
-- public.staff from inside a policy ON public.staff recurses (same reasoning
-- as current_app_role() in the baseline).

CREATE OR REPLACE FUNCTION public.current_shift7_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT access_level
  FROM public.staff
  WHERE user_id = auth.uid()
    AND status = 'active'
$$;

CREATE OR REPLACE FUNCTION public.is_shift7_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_shift7_role() = 'admin'
$$;

CREATE OR REPLACE FUNCTION public.is_shift7_scheduler_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_shift7_role() IN ('admin', 'scheduler')
$$;

-- ─── tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.facilities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  address     TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES auth.users(id)
);

DROP TRIGGER IF EXISTS trg_shift7_facilities_updated_at ON public.facilities;
CREATE TRIGGER trg_shift7_facilities_updated_at
  BEFORE UPDATE ON public.facilities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.staff (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID REFERENCES auth.users(id), -- nullable: login identity, if any
  full_name               TEXT NOT NULL,
  employee_id             TEXT NOT NULL UNIQUE,
  role                    TEXT NOT NULL CHECK (role IN ('guard', 'dispatcher')),
  qualification           TEXT NOT NULL DEFAULT 'none'
    CHECK (qualification IN ('none', 'shift_supervisor', 'lead_dispatcher')),
  primary_facility        UUID NOT NULL REFERENCES public.facilities(id),
  phone                   TEXT,
  email                   TEXT,
  status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'inactive')),
  -- Module-internal role. See current_shift7_role() above — this is what it reads.
  access_level            TEXT NOT NULL DEFAULT 'employee'
    CHECK (access_level IN ('admin', 'scheduler', 'employee', 'no_access')),
  weapon_license_expiry   DATE,
  weapon_refresh_expiry   DATE,
  medical_check_expiry    DATE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by              UUID REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS ix_shift7_staff_primary_facility ON public.staff (primary_facility);
CREATE INDEX IF NOT EXISTS ix_shift7_staff_status ON public.staff (status);
-- UNIQUE, not a plain index: current_shift7_role() below is a scalar SELECT
-- against this column and errors at runtime if it ever matches more than one
-- row. Partial so multiple staff can still have no login (user_id IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS ux_shift7_staff_user_id ON public.staff (user_id) WHERE user_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_shift7_staff_updated_at ON public.staff;
CREATE TRIGGER trg_shift7_staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.staff_credential_notification_state (
  staff_id      UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  credential_key TEXT NOT NULL CHECK (
    credential_key IN ('weapon_license_expiry', 'weapon_refresh_expiry', 'medical_check_expiry')
  ),
  state         TEXT NOT NULL DEFAULT 'none' CHECK (state IN ('none', 'urgent', 'expired')),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (staff_id, credential_key)
);
-- Only ever touched server-side (service-role client) by the credential-expiry
-- cron route — see the "no policies" note in the RLS section below.

CREATE TABLE IF NOT EXISTS public.posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  code          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('static', 'control_room')),
  facility      UUID NOT NULL REFERENCES public.facilities(id),
  required_role TEXT NOT NULL CHECK (required_role IN ('guard', 'dispatcher')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES auth.users(id),
  UNIQUE (facility, code)
);

DROP TRIGGER IF EXISTS trg_shift7_posts_updated_at ON public.posts;
CREATE TRIGGER trg_shift7_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.shift_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT NOT NULL,
  name             TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (category IN ('morning', 'afternoon', 'night')),
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  duration_hours   NUMERIC(4, 2) NOT NULL,
  post_number      INTEGER,
  color            TEXT,
  applicable_roles TEXT[] NOT NULL,
  facility         UUID REFERENCES public.facilities(id), -- null = global template
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES auth.users(id)
);

DROP TRIGGER IF EXISTS trg_shift7_shift_templates_updated_at ON public.shift_templates;
CREATE TRIGGER trg_shift7_shift_templates_updated_at
  BEFORE UPDATE ON public.shift_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.shift_assignments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id              UUID NOT NULL REFERENCES public.staff(id),
  staff_name            TEXT NOT NULL,
  shift_template_id     UUID NOT NULL REFERENCES public.shift_templates(id),
  shift_code            TEXT NOT NULL,
  post_id               UUID NOT NULL REFERENCES public.posts(id),
  post_name             TEXT,
  facility_id           UUID NOT NULL REFERENCES public.facilities(id),
  date                  DATE NOT NULL,
  actual_start          TIMESTAMPTZ NOT NULL,
  actual_end            TIMESTAMPTZ NOT NULL,
  status                TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
  is_published          BOOLEAN NOT NULL DEFAULT FALSE,
  is_emergency_override BOOLEAN NOT NULL DEFAULT FALSE,
  override_reason       TEXT,
  approved_by           UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS ix_shift7_shift_assignments_date ON public.shift_assignments (date);
CREATE INDEX IF NOT EXISTS ix_shift7_shift_assignments_facility_date ON public.shift_assignments (facility_id, date);
CREATE INDEX IF NOT EXISTS ix_shift7_shift_assignments_staff_date ON public.shift_assignments (staff_id, date);

DROP TRIGGER IF EXISTS trg_shift7_shift_assignments_updated_at ON public.shift_assignments;
CREATE TRIGGER trg_shift7_shift_assignments_updated_at
  BEFORE UPDATE ON public.shift_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.shift_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id          UUID NOT NULL REFERENCES public.staff(id),
  staff_name        TEXT NOT NULL,
  facility_id       UUID NOT NULL REFERENCES public.facilities(id),
  week_start        DATE NOT NULL,
  date              DATE NOT NULL,
  shift_template_id UUID NOT NULL REFERENCES public.shift_templates(id),
  shift_code        TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS ix_shift7_shift_requests_staff_week ON public.shift_requests (staff_id, week_start);
CREATE INDEX IF NOT EXISTS ix_shift7_shift_requests_week_status ON public.shift_requests (week_start, status);

DROP TRIGGER IF EXISTS trg_shift7_shift_requests_updated_at ON public.shift_requests;
CREATE TRIGGER trg_shift7_shift_requests_updated_at
  BEFORE UPDATE ON public.shift_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.employee_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id         UUID NOT NULL REFERENCES public.staff(id),
  staff_name       TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (
    type IN ('vacation', 'sick_leave', 'reserve_duty', 'weapon_license', 'health', 'other')
  ),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  start_date       DATE,
  end_date         DATE,
  -- Attachment, if any, lives in public.files (bucket 'documents',
  -- entity_type='employee_request', entity_id=this row's id) — not a bespoke
  -- bucket. See the RLS section below for the read policy this needs.
  notes            TEXT,
  manager_comment  TEXT,
  handled_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS ix_shift7_employee_requests_staff_created ON public.employee_requests (staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_shift7_employee_requests_created ON public.employee_requests (created_at DESC);

DROP TRIGGER IF EXISTS trg_shift7_employee_requests_updated_at ON public.employee_requests;
CREATE TRIGGER trg_shift7_employee_requests_updated_at
  BEFORE UPDATE ON public.employee_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.staffing_requirements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id  UUID NOT NULL REFERENCES public.facilities(id),
  day_group    TEXT NOT NULL CHECK (day_group IN ('weekday', 'friday', 'saturday')),
  category     TEXT NOT NULL CHECK (category IN ('morning', 'afternoon', 'night')),
  supervisor   INTEGER NOT NULL DEFAULT 0,
  guard        INTEGER NOT NULL DEFAULT 0,
  dispatcher   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID REFERENCES auth.users(id),
  UNIQUE (facility_id, day_group, category)
);

DROP TRIGGER IF EXISTS trg_shift7_staffing_requirements_updated_at ON public.staffing_requirements;
CREATE TRIGGER trg_shift7_staffing_requirements_updated_at
  BEFORE UPDATE ON public.staffing_requirements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.system_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL CHECK (category IN ('shift_limits', 'staffing_rules', 'emergency')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES auth.users(id)
);

DROP TRIGGER IF EXISTS trg_shift7_system_config_updated_at ON public.system_config;
CREATE TRIGGER trg_shift7_system_config_updated_at
  BEFORE UPDATE ON public.system_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── row level security ─────────────────────────────────────────────────────

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_credential_notification_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staffing_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Reference data: readable by any active Shift7 role, writable by shift7 admins only.
DROP POLICY IF EXISTS "shift7 read reference data" ON public.facilities;
CREATE POLICY "shift7 read reference data" ON public.facilities
  FOR SELECT TO authenticated
  USING (public.current_shift7_role() IN ('admin', 'scheduler', 'employee'));
DROP POLICY IF EXISTS "shift7 admins write facilities" ON public.facilities;
CREATE POLICY "shift7 admins write facilities" ON public.facilities
  FOR ALL TO authenticated
  USING (public.is_shift7_admin())
  WITH CHECK (public.is_shift7_admin());

DROP POLICY IF EXISTS "shift7 read reference data" ON public.posts;
CREATE POLICY "shift7 read reference data" ON public.posts
  FOR SELECT TO authenticated
  USING (public.current_shift7_role() IN ('admin', 'scheduler', 'employee'));
DROP POLICY IF EXISTS "shift7 admins write posts" ON public.posts;
CREATE POLICY "shift7 admins write posts" ON public.posts
  FOR ALL TO authenticated
  USING (public.is_shift7_admin())
  WITH CHECK (public.is_shift7_admin());

DROP POLICY IF EXISTS "shift7 read reference data" ON public.shift_templates;
CREATE POLICY "shift7 read reference data" ON public.shift_templates
  FOR SELECT TO authenticated
  USING (public.current_shift7_role() IN ('admin', 'scheduler', 'employee'));
DROP POLICY IF EXISTS "shift7 admins write shift_templates" ON public.shift_templates;
CREATE POLICY "shift7 admins write shift_templates" ON public.shift_templates
  FOR ALL TO authenticated
  USING (public.is_shift7_admin())
  WITH CHECK (public.is_shift7_admin());

DROP POLICY IF EXISTS "shift7 read reference data" ON public.staffing_requirements;
CREATE POLICY "shift7 read reference data" ON public.staffing_requirements
  FOR SELECT TO authenticated
  USING (public.current_shift7_role() IN ('admin', 'scheduler', 'employee'));
DROP POLICY IF EXISTS "shift7 admins write staffing_requirements" ON public.staffing_requirements;
CREATE POLICY "shift7 admins write staffing_requirements" ON public.staffing_requirements
  FOR ALL TO authenticated
  USING (public.is_shift7_admin())
  WITH CHECK (public.is_shift7_admin());

DROP POLICY IF EXISTS "shift7 read reference data" ON public.system_config;
CREATE POLICY "shift7 read reference data" ON public.system_config
  FOR SELECT TO authenticated
  USING (public.current_shift7_role() IN ('admin', 'scheduler', 'employee'));
DROP POLICY IF EXISTS "shift7 admins write system_config" ON public.system_config;
CREATE POLICY "shift7 admins write system_config" ON public.system_config
  FOR ALL TO authenticated
  USING (public.is_shift7_admin())
  WITH CHECK (public.is_shift7_admin());

-- staff: admin/scheduler see everyone; anyone else sees only their own row.
DROP POLICY IF EXISTS "shift7 admins and schedulers read all staff" ON public.staff;
CREATE POLICY "shift7 admins and schedulers read all staff" ON public.staff
  FOR SELECT TO authenticated
  USING (public.is_shift7_scheduler_or_admin());
DROP POLICY IF EXISTS "shift7 staff read own row" ON public.staff;
CREATE POLICY "shift7 staff read own row" ON public.staff
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "shift7 admins write staff" ON public.staff;
CREATE POLICY "shift7 admins write staff" ON public.staff
  FOR ALL TO authenticated
  USING (public.is_shift7_admin())
  WITH CHECK (public.is_shift7_admin());

-- Bootstrap: is_shift7_admin() requires an existing staff row, so without
-- this, nobody could ever create the first one for a new tenant. A caller
-- who already holds the *platform* admin role (is_admin() — ADMIN or
-- SYSTEM_MANAGER, set by the tenant provisioning wizard's admin_created
-- step) may create exactly one staff row for themselves.
DROP POLICY IF EXISTS "shift7 platform admin bootstraps own staff row" ON public.staff;
CREATE POLICY "shift7 platform admin bootstraps own staff row" ON public.staff
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_admin()
    AND NOT EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid())
  );

-- shift_assignments: admin/scheduler see and manage everything; employees see
-- only their own published shifts.
DROP POLICY IF EXISTS "shift7 admins and schedulers read all assignments" ON public.shift_assignments;
CREATE POLICY "shift7 admins and schedulers read all assignments" ON public.shift_assignments
  FOR SELECT TO authenticated
  USING (public.is_shift7_scheduler_or_admin());
DROP POLICY IF EXISTS "shift7 staff read own published assignments" ON public.shift_assignments;
CREATE POLICY "shift7 staff read own published assignments" ON public.shift_assignments
  FOR SELECT TO authenticated
  USING (
    is_published = TRUE
    AND staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid())
  );
DROP POLICY IF EXISTS "shift7 admins and schedulers write assignments" ON public.shift_assignments;
CREATE POLICY "shift7 admins and schedulers write assignments" ON public.shift_assignments
  FOR ALL TO authenticated
  USING (public.is_shift7_scheduler_or_admin())
  WITH CHECK (public.is_shift7_scheduler_or_admin());

-- shift_requests: any staff member manages their own; admin/scheduler review all.
DROP POLICY IF EXISTS "shift7 staff manage own shift_requests" ON public.shift_requests;
CREATE POLICY "shift7 staff manage own shift_requests" ON public.shift_requests
  FOR ALL TO authenticated
  USING (staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid()))
  WITH CHECK (staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "shift7 admins and schedulers read all shift_requests" ON public.shift_requests;
CREATE POLICY "shift7 admins and schedulers read all shift_requests" ON public.shift_requests
  FOR SELECT TO authenticated
  USING (public.is_shift7_scheduler_or_admin());
DROP POLICY IF EXISTS "shift7 admins and schedulers update shift_requests" ON public.shift_requests;
CREATE POLICY "shift7 admins and schedulers update shift_requests" ON public.shift_requests
  FOR UPDATE TO authenticated
  USING (public.is_shift7_scheduler_or_admin());

-- employee_requests: any staff member manages their own while it is still
-- pending; admin/scheduler review all and own the approve/reject transition.
--
-- Deliberately NOT a single "FOR ALL manage own" policy: that would let an
-- employee set their own request's status/manager_comment/handled_by
-- directly (self-approve a vacation request) via a raw Supabase call. Split
-- so a staff member can create and edit their own request only while it's
-- still 'pending', and can never touch it once admin/scheduler have acted.
DROP POLICY IF EXISTS "shift7 staff manage own employee_requests" ON public.employee_requests;
DROP POLICY IF EXISTS "shift7 staff read own employee_requests" ON public.employee_requests;
CREATE POLICY "shift7 staff read own employee_requests" ON public.employee_requests
  FOR SELECT TO authenticated
  USING (staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "shift7 staff insert own employee_requests" ON public.employee_requests;
CREATE POLICY "shift7 staff insert own employee_requests" ON public.employee_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid())
    AND status = 'pending'
  );
DROP POLICY IF EXISTS "shift7 staff update own pending employee_requests" ON public.employee_requests;
CREATE POLICY "shift7 staff update own pending employee_requests" ON public.employee_requests
  FOR UPDATE TO authenticated
  USING (
    staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid())
    AND status = 'pending'
  )
  WITH CHECK (
    staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid())
    AND status = 'pending'
  );
DROP POLICY IF EXISTS "shift7 staff delete own pending employee_requests" ON public.employee_requests;
CREATE POLICY "shift7 staff delete own pending employee_requests" ON public.employee_requests
  FOR DELETE TO authenticated
  USING (
    staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid())
    AND status = 'pending'
  );
DROP POLICY IF EXISTS "shift7 admins and schedulers read all employee_requests" ON public.employee_requests;
CREATE POLICY "shift7 admins and schedulers read all employee_requests" ON public.employee_requests
  FOR SELECT TO authenticated
  USING (public.is_shift7_scheduler_or_admin());
DROP POLICY IF EXISTS "shift7 admins and schedulers update employee_requests" ON public.employee_requests;
CREATE POLICY "shift7 admins and schedulers update employee_requests" ON public.employee_requests
  FOR UPDATE TO authenticated
  USING (public.is_shift7_scheduler_or_admin());

-- staff_credential_notification_state: default-deny for every client role.
-- RLS is enabled above with no policies added — only the cron route, using
-- the service-role client (bypasses RLS entirely), ever touches this table.

-- ─── files: employee-request attachments ────────────────────────────────────
--
-- Reuses the platform's generic 'documents' bucket + public.files registry
-- (app/api/files/upload) rather than a bespoke bucket. The baseline's
-- files_select policy already covers the uploader reading their own row
-- (auth.uid() = user_id) — this policy is additive, granting shift7
-- schedulers/admins read access to *other* staff members' request
-- attachments, same-command policies are OR'd so the baseline policy is
-- untouched.
--
-- NOTE: this only covers the public.files index row. Whether Storage's own
-- object-level access needs a matching storage.objects policy, or whether
-- object bytes are only ever served through a server route using the
-- session/service-role client, hasn't been verified against this repo's
-- actual storage.objects configuration yet — check before relying on direct
-- client-side downloads of another user's attachment.
DROP POLICY IF EXISTS "shift7 schedulers read employee request files" ON public.files;
CREATE POLICY "shift7 schedulers read employee request files" ON public.files
  FOR SELECT TO authenticated
  USING (
    bucket = 'documents'
    AND entity_type = 'employee_request'
    AND public.is_shift7_scheduler_or_admin()
  );
