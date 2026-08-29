/**
 * User roles.
 *
 * ── ADDING A ROLE ────────────────────────────────────────────────────────────
 * 1. Add the key here.
 * 2. lib/constants/roles.ts   — Hebrew label + hierarchy position  (compiler-forced)
 * 3. lib/constants/permissions.ts — HOME_PAGES entry               (compiler-forced)
 *    and add the role to whichever ROUTE_PERMISSIONS arrays it may reach.
 * 4. A new migration widening users_app_role_check, then
 *    `npm run sync-tenant-migrations`.
 *
 * Steps 2 and 3 are declared as total `Record<UserRole, …>` maps, so the build
 * breaks until you fill them in. That is deliberate — see the
 * `roles-permissions` skill.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A const object rather than a TS `enum`: the value round-trips through
 * Postgres TEXT and JSON, and a union of string literals compares cleanly with
 * both without any conversion.
 */
export const USER_ROLES = {
  ADMIN: 'ADMIN',
  SYSTEM_MANAGER: 'SYSTEM_MANAGER',
  /**
   * Generic low-privilege member — no platform-admin rights. Exists so a
   * module with its own fine-grained roles (e.g. Shift7's staff.access_level)
   * has something to hold at the platform layer just to pass login/approval
   * gating. Real permissions for those users live in the module's own schema,
   * not here — see the `roles-permissions` skill's note on keeping domain
   * roles out of this file.
   */
  STAFF: 'STAFF',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const ALL_ROLES = Object.values(USER_ROLES) as UserRole[];

/**
 * A user row carries `app_role: UserRole | null`. NULL means "signed up but not
 * yet approved" — the user lands on /app/pending-approval until an admin
 * assigns a role.
 */
export type AppRole = UserRole | null;

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (ALL_ROLES as string[]).includes(value);
}
