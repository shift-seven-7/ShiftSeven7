import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  badRequest,
  forbidden,
  getAuthInfo,
  notFound,
  requireApproved,
  serverError,
} from '@/lib/api/auth';
import { canManageRole, isSuperRole } from '@/lib/constants/roles';
import { isUserRole } from '@/types/roles';
import { ALL_FEATURE_KEYS } from '@/lib/constants/features';
import type { UserRow } from '@/types/database.types';

/**
 * Read, update, and delete a single user.
 *
 * The authorization rule that matters: you cannot grant or remove a role above
 * your own. With two roles that only stops a SYSTEM_MANAGER from minting an
 * ADMIN — but the check is written against the hierarchy, so it keeps holding
 * as roles are added.
 */

/** The only fields a caller may set. Anything else in the body is ignored. */
type UserUpdate = Partial<
  Pick<UserRow, 'full_name' | 'phone' | 'app_role' | 'is_active' | 'features_override'>
>;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();

  if (error) return serverError('טעינת המשתמש נכשלה');
  if (!data) return notFound('המשתמש לא נמצא');

  return NextResponse.json({ user: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  if (!auth) return forbidden();
  if (!isSuperRole(auth.userRole)) return forbidden();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  const { data: target } = await supabase
    .from('users')
    .select('id, app_role')
    .eq('id', id)
    .maybeSingle();

  if (!target) return notFound('המשתמש לא נמצא');

  // Cannot edit someone who outranks you.
  if (isUserRole(target.app_role) && !canManageRole(auth.userRole, target.app_role)) {
    return forbidden('אין לך הרשאה לערוך משתמש בתפקיד זה');
  }

  // Built field by field rather than by spreading the body: an allow-list you
  // can read is the point of this handler.
  const patch: UserUpdate = {};

  if ('full_name' in body) {
    patch.full_name = typeof body.full_name === 'string' ? body.full_name : null;
  }
  if ('phone' in body) {
    patch.phone = typeof body.phone === 'string' ? body.phone : null;
  }

  if ('app_role' in body) {
    const nextRole = body.app_role;

    if (nextRole !== null && !isUserRole(nextRole)) {
      return badRequest('תפקיד לא תקין');
    }
    // Cannot promote anyone above yourself.
    if (isUserRole(nextRole) && !canManageRole(auth.userRole, nextRole)) {
      return forbidden('אין לך הרשאה לשייך תפקיד זה');
    }
    // Changing your own role would take effect mid-session and could lock you
    // out of the page you are standing on.
    if (id === auth.userId && nextRole !== auth.userRole) {
      return badRequest('לא ניתן לשנות את התפקיד של עצמך');
    }
    patch.app_role = isUserRole(nextRole) ? nextRole : null;
  }

  if ('is_active' in body) {
    if (id === auth.userId && body.is_active === false) {
      return badRequest('לא ניתן להשבית את החשבון של עצמך');
    }
    patch.is_active = body.is_active === true;
  }

  if ('features_override' in body) {
    const overrides = body.features_override;
    if (typeof overrides !== 'object' || overrides === null || Array.isArray(overrides)) {
      return badRequest('הגדרות המודולים אינן תקינות');
    }
    // Drop keys that are not real modules, so a stale client cannot accumulate
    // junk in the column.
    patch.features_override = Object.fromEntries(
      Object.entries(overrides as Record<string, unknown>)
        .filter(([key]) => (ALL_FEATURE_KEYS as string[]).includes(key))
        .map(([key, value]) => [key, value === true])
    );
  }

  if (Object.keys(patch).length === 0) {
    return badRequest('אין שדות לעדכון');
  }

  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[api/users/:id] update failed:', error.message);
    return serverError('עדכון המשתמש נכשל');
  }

  return NextResponse.json({ user: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  if (!auth) return forbidden();
  if (!isSuperRole(auth.userRole)) return forbidden();
  if (id === auth.userId) return badRequest('לא ניתן למחוק את החשבון של עצמך');

  const { data: target } = await supabase
    .from('users')
    .select('id, app_role')
    .eq('id', id)
    .maybeSingle();

  if (!target) return notFound('המשתמש לא נמצא');
  if (isUserRole(target.app_role) && !canManageRole(auth.userRole, target.app_role)) {
    return forbidden('אין לך הרשאה למחוק משתמש בתפקיד זה');
  }

  // Deleting the auth user cascades to public.users via the FK. Doing it in
  // that order means a failure leaves the account intact rather than orphaning
  // a login with no profile.
  const service = await createServiceClient();
  const { error } = await service.auth.admin.deleteUser(id);

  if (error) {
    console.error('[api/users/:id] delete failed:', error.message);
    return serverError('מחיקת המשתמש נכשלה');
  }

  return NextResponse.json({ success: true });
}
