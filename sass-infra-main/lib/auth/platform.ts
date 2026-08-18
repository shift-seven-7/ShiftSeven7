import { headers } from 'next/headers';
import type { NextResponse } from 'next/server';
import {
  forbidden,
  getAuthInfo,
  requireRoles,
  unauthorized,
  type AuthInfo,
} from '@/lib/api/auth';
import { TENANT_ADMIN_ROLES } from '@/lib/constants/roles';
import { createClient } from '@/lib/supabase/server';
import { getMasterUserEmail } from '@/lib/supabase/master-auth';

/**
 * Who may operate the platform, as opposed to a tenant.
 *
 * ── THE PROBLEM THIS SOLVES ──────────────────────────────────────────────────
 * Managing the platform used to require the `ADMIN` role — a role every
 * customer's own administrator holds. That made any customer admin able to list
 * every tenant, edit their records, and provision Supabase projects on the
 * operator's account. Tenant-level admin and platform-level operator are
 * different jobs and need different gates.
 *
 * `PLATFORM_OPERATOR_EMAILS` is that second gate: a comma-separated allow-list.
 * An env var rather than a table because the operator set is a property of the
 * deployment, changes about once a year, and putting it in a tenant's own
 * database would let that tenant edit it.
 *
 * ── TWO WAYS IN, TWO STRICTNESSES ────────────────────────────────────────────
 * | Entry | Identity | Allow-list |
 * |---|---|---|
 * | /backoffice          | the master project's own auth (Google) | **required** |
 * | /app/admin/tenants   | a tenant's auth + the ADMIN role       | falls back |
 *
 * The difference is not an oversight. The in-tenant console already requires an
 * approved ADMIN account inside a real tenant, so an empty allow-list degrades
 * to the old behaviour — tolerable for a single-customer deployment.
 *
 * The backoffice has no such second factor: the master project has no `users`
 * table, no roles, and Google will happily mint a session for any address on
 * earth. There the allow-list IS the authorization, so an empty one must mean
 * "nobody", never "everybody".
 */

function parseOperators(): string[] {
  return (process.env.PLATFORM_OPERATOR_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

const OPERATORS = parseOperators();

/** Strict: an empty allow-list admits nobody. Used for master-session access. */
export function isAllowedOperatorEmail(email: string | undefined | null): boolean {
  if (OPERATORS.length === 0 || !email) return false;
  return OPERATORS.includes(email.toLowerCase());
}

export function hasOperatorAllowList(): boolean {
  return OPERATORS.length > 0;
}

let warned = false;

/**
 * Lenient: an empty allow-list falls back to the role alone.
 *
 * Only for the in-tenant console, where an approved ADMIN account is already
 * required. Never for the backoffice — see the header.
 */
export function isPlatformOperator(email: string | undefined): boolean {
  if (OPERATORS.length === 0) {
    if (!warned) {
      warned = true;
      console.warn(
        '[auth] PLATFORM_OPERATOR_EMAILS is not set — every tenant ADMIN can ' +
          'reach the tenant registry console, and /backoffice admits nobody. ' +
          'Set it before onboarding a second tenant.'
      );
    }
    return true;
  }

  return isAllowedOperatorEmail(email);
}

/**
 * Guard for a route reached from inside a tenant.
 *
 * Deliberately both checks: the allow-list says *who*, the role still says
 * *what they are* on this tenant. An operator whose account was deactivated or
 * demoted loses access without anyone editing an env var.
 */
export function requirePlatformOperator(auth: AuthInfo | null): NextResponse | null {
  if (!auth) return unauthorized();

  const denied = requireRoles(auth, TENANT_ADMIN_ROLES);
  if (denied) return denied;

  if (!isPlatformOperator(auth.userEmail)) {
    // Same message as any other denial — confirming that a platform console
    // exists is information a tenant admin does not need.
    return forbidden();
  }

  return null;
}

/**
 * The guard every `/api/admin/tenants/**` route uses.
 *
 * Accepts either entry point, because the same endpoints serve both consoles:
 *
 *   1. a master session whose email is on the allow-list — the backoffice,
 *      which works on hosts where no tenant resolves at all
 *   2. otherwise, the tenant session the request already carries
 *
 * The fall-through in that order matters. A master session that is NOT on the
 * allow-list must not block a legitimate tenant ADMIN using the old console on
 * the same host — so it declines to grant access rather than actively denying.
 */
export async function requireOperatorAccess(): Promise<NextResponse | null> {
  const operatorEmail = await getMasterUserEmail();
  if (operatorEmail && isAllowedOperatorEmail(operatorEmail)) return null;

  // Only attempt the tenant path when the request actually carries a tenant —
  // `createClient()` throws without the proxy's headers, and on the apex there
  // are none.
  const headersList = await headers();
  if (headersList.get('x-supabase-url')) {
    const supabase = await createClient();
    const auth = await getAuthInfo(supabase);
    return requirePlatformOperator(auth);
  }

  return operatorEmail ? forbidden() : unauthorized();
}
