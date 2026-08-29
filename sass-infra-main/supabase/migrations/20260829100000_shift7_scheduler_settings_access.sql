-- =============================================================================
-- Schedulers can now reach the whole /app/shift7/settings page, not just
-- admins — a scheduler manages the facilities they're responsible for and
-- should be able to create/edit them, plus the module's shift-limit/emergency
-- config, without needing the platform admin to do it for them.
--
-- Widens two write policies from is_shift7_admin() to
-- is_shift7_scheduler_or_admin(). Read policies on both tables were already
-- open to any active Shift7 role — only writes were admin-only.
-- =============================================================================

DROP POLICY IF EXISTS "shift7 admins write facilities" ON public.facilities;
CREATE POLICY "shift7 admins write facilities" ON public.facilities
  FOR ALL TO authenticated
  USING (public.is_shift7_scheduler_or_admin())
  WITH CHECK (public.is_shift7_scheduler_or_admin());

DROP POLICY IF EXISTS "shift7 admins write system_config" ON public.system_config;
CREATE POLICY "shift7 admins write system_config" ON public.system_config
  FOR ALL TO authenticated
  USING (public.is_shift7_scheduler_or_admin())
  WITH CHECK (public.is_shift7_scheduler_or_admin());
