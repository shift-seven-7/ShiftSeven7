-- =============================================================================
-- Scheduler must never read the platform admin's Shift7 staff row.
--
-- WHY
-- "shift7 admins and schedulers read all staff" (20260104000000_shift7_baseline.sql)
-- checks only the CALLER's role (admin or scheduler) — never the TARGET
-- row's access_level. A scheduler's SELECT is unfiltered, so /app/shift7/staff
-- (and every staff-picker dropdown fed by the same table, e.g. smart-schedule)
-- showed the admin's own row, labeled "מנהל מערכת". This is the read-side
-- counterpart of "shift7 schedulers write non-admin staff" (same baseline
-- file), which already blocks a scheduler from editing/deleting/creating an
-- admin-level row — that fix only ever covered writes.
--
-- Splits the previous combined SELECT policy in two, one per role, mirroring
-- the write-side split exactly. "shift7 staff read own row" (baseline) is
-- untouched — RLS policies are OR'd, so a scheduler still reads their own
-- row via that separate policy regardless of this split.
-- =============================================================================

DROP POLICY IF EXISTS "shift7 admins and schedulers read all staff" ON public.staff;

DROP POLICY IF EXISTS "shift7 admins read all staff" ON public.staff;
CREATE POLICY "shift7 admins read all staff" ON public.staff
  FOR SELECT TO authenticated
  USING (public.is_shift7_admin());

DROP POLICY IF EXISTS "shift7 schedulers read non-admin staff" ON public.staff;
CREATE POLICY "shift7 schedulers read non-admin staff" ON public.staff
  FOR SELECT TO authenticated
  USING (public.current_shift7_role() = 'scheduler' AND access_level <> 'admin');
