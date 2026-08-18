import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { isUserRole, type UserRole } from '@/types/roles';
import { isSuperRole } from '@/lib/constants/roles';

/**
 * The authorization helper every API route starts with.
 *
 * There is no route middleware doing this: proxy.ts resolves the tenant, but
 * each route decides for itself who may call it. That is deliberate — an
 * authorization rule you can read at the top of the handler is one you can
 * verify.
 */

export interface AuthInfo {
  userId: string;
  userEmail: string | undefined;
  /** null = approved account pending a role assignment. */
  userRole: UserRole | null;
  userName: string | null;
  isActive: boolean;
}

export interface TenantInfo {
  tenantId: string;
  subdomain: string;
}

export async function getTenantInfo(): Promise<TenantInfo> {
  const headersList = await headers();
  return {
    tenantId: headersList.get('x-tenant-id') ?? 'unknown',
    subdomain: headersList.get('x-tenant-subdomain') ?? 'unknown',
  };
}

/**
 * Resolves the caller from the Supabase session plus their `public.users` row.
 * Returns null when there is no session, no profile row, or the account is
 * deactivated.
 *
 * `allowInactive` exists for exactly one caller — /api/users/me — which needs
 * to tell the client "your account was disabled" instead of a bare 401.
 */
export async function getAuthInfo(
  supabase: SupabaseClient<Database>,
  options?: { allowInactive?: boolean }
): Promise<AuthInfo | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('app_role, full_name, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return null;
  if (!options?.allowInactive && profile.is_active === false) return null;

  return {
    userId: user.id,
    userEmail: user.email,
    userRole: isUserRole(profile.app_role) ? profile.app_role : null,
    userName: profile.full_name,
    isActive: profile.is_active,
  };
}

// ─── standard responses ──────────────────────────────────────────────────────

export function unauthorized(message = 'נדרשת התחברות') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'אין לך הרשאה לבצע פעולה זו') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = 'לא נמצא') {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message = 'שגיאת שרת') {
  return NextResponse.json({ error: message }, { status: 500 });
}

// ─── guards ──────────────────────────────────────────────────────────────────

/** True when the caller holds one of `roles`. */
export function hasRole(auth: AuthInfo | null, roles: UserRole[]): boolean {
  return !!auth?.userRole && roles.includes(auth.userRole);
}

export function isAdmin(auth: AuthInfo | null): boolean {
  return isSuperRole(auth?.userRole);
}

/**
 * Guard for a route restricted to specific roles.
 *
 * Returns a ready-to-return error response, or null when the caller passes:
 *
 *   const auth = await getAuthInfo(supabase);
 *   const denied = requireRoles(auth, TENANT_ADMIN_ROLES);
 *   if (denied) return denied;
 */
export function requireRoles(
  auth: AuthInfo | null,
  roles: UserRole[]
): NextResponse | null {
  if (!auth) return unauthorized();
  if (!auth.userRole) return forbidden('החשבון ממתין לאישור מנהל');
  if (!roles.includes(auth.userRole)) return forbidden();
  return null;
}

/** Guard for a route any approved user may call. */
export function requireApproved(auth: AuthInfo | null): NextResponse | null {
  if (!auth) return unauthorized();
  if (!auth.userRole) return forbidden('החשבון ממתין לאישור מנהל');
  return null;
}

// ─── logging ─────────────────────────────────────────────────────────────────

interface LogParams {
  route: string;
  method: string;
  status: number;
  error?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string | null;
  tenantId?: string;
  subdomain?: string;
  extra?: Record<string, unknown>;
}

/**
 * Structured log for a non-2xx API outcome. One JSON line per event so it is
 * greppable in whatever log sink the project ends up using.
 */
export function apiLog(params: LogParams): void {
  const payload = JSON.stringify({ ...params, timestamp: new Date().toISOString() });
  if (params.status >= 500) {
    console.error('[api]', payload);
  } else {
    console.warn('[api]', payload);
  }
}
