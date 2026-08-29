import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { badRequest, forbidden, getAuthInfo, notFound, requireApproved, serverError } from '@/lib/api/auth';
import { USER_ROLES } from '@/types/roles';

/**
 * Creates a login for an EXISTING staff member and links it via staff.user_id.
 *
 * Ported from web/src/app/actions/auth.ts's createStaffLogin (the original
 * GuardSync app), adapted from its JWT-claim admin check to this repo's
 * current_shift7_role()/RLS pattern. Two writes that must not diverge — the
 * auth user (service role) and the profile row — same rollback rule as
 * /api/users/invite: if the profile insert fails, the auth user is deleted.
 *
 * No password is set here, matching /api/users/invite's convention exactly:
 * the new login has no credentials until the person uses "forgot password".
 */

/** 'admin' | 'scheduler' | 'employee' | 'no_access' | null (no active staff row). */
async function getShift7Role(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const { data } = await supabase.rpc('current_shift7_role');
  return data;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const shift7Role = await getShift7Role(supabase);
  if (shift7Role !== 'admin' && shift7Role !== 'scheduler') {
    return forbidden('רק מנהל או משבץ Shift7 יכולים ליצור חשבון התחברות לאיש צוות');
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) return badRequest('נא להזין אימייל');

  const { data: staffMember, error: staffError } = await supabase
    .from('staff')
    .select('id, user_id, full_name, access_level')
    .eq('id', id)
    .maybeSingle();

  if (staffError) return serverError('טעינת איש הצוות נכשלה');
  if (!staffMember) return notFound('איש הצוות לא נמצא');
  if (staffMember.user_id) return badRequest('לאיש הצוות כבר יש חשבון התחברות');

  // Same escalation guard as PATCH/DELETE on this staff row: a scheduler may
  // manage day-to-day staff but never an admin-level one.
  if (shift7Role === 'scheduler' && staffMember.access_level === 'admin') {
    return forbidden('משבץ אינו יכול ליצור חשבון עבור איש צוות בעל הרשאת מנהל מערכת');
  }

  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existingUser) return badRequest('משתמש עם כתובת האימייל הזו כבר קיים');

  const service = await createServiceClient();

  const { data: created, error: authError } = await service.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (authError || !created.user) {
    console.error('[api/shift7/staff/:id/create-login] auth user creation failed:', authError?.message);
    return serverError('יצירת החשבון נכשלה');
  }

  const { error: profileError } = await service.from('users').insert({
    id: created.user.id,
    email,
    full_name: staffMember.full_name,
    app_role: USER_ROLES.STAFF,
    is_active: true,
    is_managed: false,
    invited_at: new Date().toISOString(),
  });

  if (profileError) {
    await service.auth.admin.deleteUser(created.user.id);
    console.error('[api/shift7/staff/:id/create-login] profile insert failed:', profileError.message);
    return serverError('יצירת החשבון נכשלה');
  }

  // .is('user_id', null) closes the race between the check above and this
  // write: if a concurrent request already linked this staff row, this
  // matches zero rows instead of overwriting that link.
  const { data: linked, error: linkError } = await service
    .from('staff')
    .update({ user_id: created.user.id })
    .eq('id', id)
    .is('user_id', null)
    .select()
    .maybeSingle();

  if (linkError) {
    console.error('[api/shift7/staff/:id/create-login] staff link failed:', linkError.message);
    return serverError('החשבון נוצר אך קישורו לרשומת הצוות נכשל');
  }

  if (!linked) {
    // Lost the race — this staff row already got a login from a concurrent
    // request. Roll back so this attempt doesn't leave an orphaned account
    // (public.users cascades from auth.users on delete).
    await service.auth.admin.deleteUser(created.user.id);
    return badRequest('לאיש הצוות כבר יש חשבון התחברות');
  }

  return NextResponse.json({ staffMember: linked });
}
