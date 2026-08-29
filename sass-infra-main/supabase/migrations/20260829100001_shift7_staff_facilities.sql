-- =============================================================================
-- staff <-> facilities, many-to-many.
--
-- staff.primary_facility is UNCHANGED — it stays the default/home facility
-- (employee_id numbering, default filters). This table is the ADDITIONAL set
-- of facilities a staff member can also work at, e.g. because their manager
-- holds more than one facility.
--
-- Phase 1 only: this is UI-level filtering (staff pickers, shift-request
-- template lists), not a hard constraint on shift_assignments/shift_requests
-- — a scheduler can still create a shift for a staff member at a facility
-- they aren't a member of. Enforcing that at the database level, and scoping
-- schedulers themselves to their own facilities, is a separate future change.
--
-- RLS mirrors staff's own split-by-target-role-and-access_level pattern from
-- 20260822000000_shift7_scheduler_staff_read_scope.sql exactly: admins see/
-- manage everything, schedulers see/manage non-admin staff's memberships
-- only, and a staff member reads their own.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.staff_facilities (
  staff_id    UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (staff_id, facility_id)
);
CREATE INDEX IF NOT EXISTS ix_shift7_staff_facilities_facility ON public.staff_facilities (facility_id);

ALTER TABLE public.staff_facilities ENABLE ROW LEVEL SECURITY;

-- ─── read ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "shift7 admins read all staff_facilities" ON public.staff_facilities;
CREATE POLICY "shift7 admins read all staff_facilities" ON public.staff_facilities
  FOR SELECT TO authenticated
  USING (public.is_shift7_admin());

DROP POLICY IF EXISTS "shift7 schedulers read non-admin staff_facilities" ON public.staff_facilities;
CREATE POLICY "shift7 schedulers read non-admin staff_facilities" ON public.staff_facilities
  FOR SELECT TO authenticated
  USING (
    public.current_shift7_role() = 'scheduler'
    AND EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = staff_facilities.staff_id AND s.access_level <> 'admin'
    )
  );

DROP POLICY IF EXISTS "shift7 staff read own staff_facilities" ON public.staff_facilities;
CREATE POLICY "shift7 staff read own staff_facilities" ON public.staff_facilities
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = staff_facilities.staff_id AND s.user_id = auth.uid()
    )
  );

-- ─── write ───────────────────────────────────────────────────────────────────
-- Same escalation rule as "shift7 schedulers write non-admin staff": a
-- scheduler may manage day-to-day staff's facilities but never an
-- admin-level staff member's.

DROP POLICY IF EXISTS "shift7 admins write staff_facilities" ON public.staff_facilities;
CREATE POLICY "shift7 admins write staff_facilities" ON public.staff_facilities
  FOR ALL TO authenticated
  USING (public.is_shift7_admin())
  WITH CHECK (public.is_shift7_admin());

DROP POLICY IF EXISTS "shift7 schedulers write non-admin staff_facilities" ON public.staff_facilities;
CREATE POLICY "shift7 schedulers write non-admin staff_facilities" ON public.staff_facilities
  FOR ALL TO authenticated
  USING (
    public.current_shift7_role() = 'scheduler'
    AND EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = staff_facilities.staff_id AND s.access_level <> 'admin'
    )
  )
  WITH CHECK (
    public.current_shift7_role() = 'scheduler'
    AND EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = staff_facilities.staff_id AND s.access_level <> 'admin'
    )
  );

-- ─── backfill ────────────────────────────────────────────────────────────────
-- Every existing staff row's current primary_facility becomes its first
-- membership, so nobody loses access on deploy day. Idempotent: re-running
-- this migration (or replaying it onto a project that already has the row)
-- is a no-op via ON CONFLICT.

INSERT INTO public.staff_facilities (staff_id, facility_id)
SELECT id, primary_facility FROM public.staff
ON CONFLICT DO NOTHING;
