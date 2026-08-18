-- =============================================================================
-- Add the STAFF platform role.
--
-- WHY
-- A module with its own fine-grained roles (Shift7's staff.access_level:
-- admin/scheduler/employee/no_access) still needs its users to hold SOME
-- platform app_role, because app_role IS NULL means "pending approval" and
-- blocks /app entirely (see requireApproved()). Reusing ADMIN/SYSTEM_MANAGER
-- for that would mislabel a guard as a platform manager and put them in
-- TENANT_ADMIN-adjacent territory they have no business in.
--
-- STAFF is deliberately generic — not module-named — so any future
-- low-privilege module reuses it instead of minting its own throwaway role.
-- It carries no privilege of its own beyond "signed in, approved"; real
-- permissions for a STAFF user live entirely in the module's own schema/RLS.
--
-- See the `roles-permissions` skill.
-- =============================================================================

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_app_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_app_role_check
  CHECK (app_role IS NULL OR app_role IN ('ADMIN', 'SYSTEM_MANAGER', 'STAFF'));

-- =============================================================================
-- Narrow users_select_all.
--
-- The baseline's "any authenticated user reads the whole directory" policy
-- was documented as acceptable only "for a two-role admin tool" — this is the
-- low-privilege role that retires it. A STAFF user (potentially dozens per
-- tenant, e.g. every guard on a roster) has no business reading every other
-- user's email/phone via the generic users table.
--
-- ADMIN/SYSTEM_MANAGER keep full read via is_admin(); everyone keeps reading
-- their own row.
-- =============================================================================

DROP POLICY IF EXISTS "users_select_all" ON public.users;
DROP POLICY IF EXISTS "users_select_self_or_admin" ON public.users;
CREATE POLICY "users_select_self_or_admin" ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin());
