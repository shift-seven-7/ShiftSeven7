import { USER_ROLES, type UserRole } from '@/types/roles';

/**
 * Role metadata. See types/roles.ts for the add-a-role checklist.
 *
 * Every map here is a TOTAL `Record<UserRole, …>` on purpose: adding a role to
 * USER_ROLES breaks the build until it is described here, so a new role can
 * never ship half-defined.
 */

export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  ADMIN: 'מנהל מערכת',
  SYSTEM_MANAGER: 'מנהל',
  STAFF: 'צוות',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: 'גישה מלאה, כולל ניהול טננטים והגדרות מערכת',
  SYSTEM_MANAGER: 'ניהול משתמשים והגדרות, ללא גישה לניהול טננטים',
  STAFF: 'גישה למודולים בלבד, ללא ניהול משתמשים או הגדרות מערכת',
};

/**
 * Weakest to strongest. A user may only assign or delete roles at or below
 * their own position.
 */
export const ROLE_HIERARCHY: UserRole[] = [
  USER_ROLES.STAFF,
  USER_ROLES.SYSTEM_MANAGER,
  USER_ROLES.ADMIN,
];

/**
 * Roles offered in the invite dialog. STAFF is deliberately excluded: Shift7
 * (and any future module using this role) creates its own accounts through
 * its own admin-provisioned flow, which sets `app_role='STAFF'` and the
 * module's own row atomically. Inviting STAFF through the generic dialog
 * would produce a platform login with no matching module record.
 */
export const ASSIGNABLE_ROLES: UserRole[] = [USER_ROLES.SYSTEM_MANAGER, USER_ROLES.ADMIN];

/**
 * Roles that see everything regardless of module flags. Keeping this list
 * explicit — rather than hardcoding `role === 'ADMIN'` across the codebase —
 * is what makes a new privileged role a one-line change.
 */
export const SUPER_ROLES: UserRole[] = [USER_ROLES.ADMIN, USER_ROLES.SYSTEM_MANAGER];

/** Only ADMIN reaches the tenant registry console. */
export const TENANT_ADMIN_ROLES: UserRole[] = [USER_ROLES.ADMIN];

export function isSuperRole(role: UserRole | null | undefined): boolean {
  return !!role && SUPER_ROLES.includes(role);
}

export function roleRank(role: UserRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

/** Can `actor` assign, edit, or remove someone holding `target`? */
export function canManageRole(actor: UserRole | null, target: UserRole): boolean {
  if (!actor) return false;
  return roleRank(actor) >= roleRank(target);
}

export function getRoleDisplayName(role: UserRole | null | undefined): string {
  if (!role) return 'ממתין לאישור';
  return ROLE_DISPLAY_NAMES[role] ?? role;
}
