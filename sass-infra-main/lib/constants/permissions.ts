import { USER_ROLES, type UserRole } from '@/types/roles';
import { TENANT_ADMIN_ROLES } from '@/lib/constants/roles';
import { getRequiredFeatures } from '@/lib/constants/features';

/**
 * Route authorization.
 *
 * Two independent gates, both enforced in app/app/ProtectedAppLayoutClient.tsx
 * and mirrored server-side by each API route:
 *   ROUTE_PERMISSIONS — who (role)
 *   ROUTE_FEATURES    — what the tenant bought (module), in features.ts
 *
 * These are UI-level guards. They are not the security boundary — RLS and the
 * per-route role checks are. Never rely on a hidden nav item to protect data.
 */

const ALL: UserRole[] = [USER_ROLES.ADMIN, USER_ROLES.SYSTEM_MANAGER];

/** Platform roles plus STAFF — for routes a module's own low-privilege users also reach. */
const ALL_INCLUDING_STAFF: UserRole[] = [...ALL, USER_ROLES.STAFF];

/** Where a user with no role yet is parked. */
export const PENDING_APPROVAL_ROUTE = '/app/pending-approval';

/**
 * Everything under here manages the PLATFORM, not the tenant: the registry, the
 * provisioning wizard, other tenants' settings. A role is not enough to reach
 * it — see lib/auth/platform.ts.
 *
 * Kept as one prefix so a deployment that later wants the console on its own
 * host has a single thing for the proxy to route.
 */
export const PLATFORM_ROUTE_PREFIX = '/app/admin';

/**
 * Route prefix → roles allowed. A route absent from this map is allowed for
 * any signed-in user with a role.
 */
export const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  '/app/home': ALL,
  '/app/profile': ALL_INCLUDING_STAFF,
  '/app/users': ALL,
  '/app/settings': ALL,
  '/app/admin/tenants': TENANT_ADMIN_ROLES,
  [PENDING_APPROVAL_ROUTE]: ALL,
  // Module gate — which STAFF-level users beyond this reach inside Shift7 is
  // enforced by the module's own role helper, not here. See the Shift7
  // feature entry in features.ts and the `roles-permissions` skill.
  '/app/shift7': ALL_INCLUDING_STAFF,
};

/**
 * Landing page per role. Total by construction — a new role will not compile
 * until it has one.
 */
export const HOME_PAGES: Record<UserRole, string> = {
  ADMIN: '/app/home',
  SYSTEM_MANAGER: '/app/home',
  STAFF: '/app/shift7',
};

/** Tried in order when a role's home page is gated off. */
export const HOME_FALLBACK_CHAIN = ['/app/home', '/app/profile', PENDING_APPROVAL_ROUTE];

export function canAccessRoute(pathname: string, role: UserRole | null): boolean {
  if (!role) return pathname === PENDING_APPROVAL_ROUTE;

  const match = Object.keys(ROUTE_PERMISSIONS)
    .filter((route) => pathname === route || pathname.startsWith(`${route}/`))
    .sort((a, b) => b.length - a.length)[0];

  if (!match) return true;
  return ROUTE_PERMISSIONS[match].includes(role);
}

/**
 * The first page this user can actually open.
 *
 * `isFeatureVisible` is injected rather than imported so this stays a pure
 * function usable from both the proxy (no React) and the client.
 */
export function getEffectiveHomePage(
  role: UserRole | null,
  isFeatureVisible: (key: string) => boolean = () => true
): string {
  if (!role) return PENDING_APPROVAL_ROUTE;

  const candidates = [HOME_PAGES[role], ...HOME_FALLBACK_CHAIN];

  for (const candidate of candidates) {
    if (!canAccessRoute(candidate, role)) continue;

    const required = getRequiredFeatures(candidate);
    if (required && !required.every(isFeatureVisible)) continue;

    return candidate;
  }

  return PENDING_APPROVAL_ROUTE;
}
