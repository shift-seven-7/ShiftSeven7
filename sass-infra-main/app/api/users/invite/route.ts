import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  badRequest,
  forbidden,
  getAuthInfo,
  serverError,
} from '@/lib/api/auth';
import { ASSIGNABLE_ROLES, canManageRole, isSuperRole } from '@/lib/constants/roles';
import { getInviteChannels } from '@/lib/auth/methods';
import { isUserRole } from '@/types/roles';

/**
 * Creates a user directly, with a role already assigned.
 *
 * Two writes that must not diverge: the auth user (service role) and the
 * profile row. If the profile insert fails the auth user is deleted, so a
 * failed invite leaves nothing behind for the admin to clean up.
 *
 * ── CHANNEL ──────────────────────────────────────────────────────────────────
 * The identifier follows the deployment's sign-in methods, not this file's
 * assumptions. Inviting by email on a phone-OTP deployment would create an
 * account nobody can sign in to, so `getInviteChannels()` decides what is
 * accepted. Both branches create the account already confirmed and without a
 * password — the invitee sets one through "forgot password", signs in with a
 * provider, or receives a one-time code.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  if (!auth) return forbidden();
  if (!isSuperRole(auth.userRole)) return forbidden();

  let body: { email?: string; phone?: string; fullName?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  const channels = getInviteChannels();
  const email = channels.includes('email') ? body.email?.trim().toLowerCase() : undefined;
  const phone = channels.includes('phone') ? body.phone?.trim() : undefined;
  const role = body.role;

  if (!email && !phone) {
    return badRequest(
      channels.includes('phone') && !channels.includes('email')
        ? 'נא להזין מספר טלפון'
        : 'נא להזין אימייל'
    );
  }
  if (!isUserRole(role) || !ASSIGNABLE_ROLES.includes(role)) {
    return badRequest('תפקיד לא תקין');
  }
  if (!canManageRole(auth.userRole, role)) {
    return forbidden('אין לך הרשאה לשייך תפקיד זה');
  }

  // Two separate filters rather than one `.or()` string — an interpolated
  // PostgREST filter would let a crafted address rewrite the query.
  const duplicateQuery = supabase.from('users').select('id');
  const { data: existing } = email
    ? await duplicateQuery.eq('email', email).maybeSingle()
    : await duplicateQuery.eq('phone', phone!).maybeSingle();

  if (existing) return badRequest('משתמש עם פרטי הקשר האלה כבר קיים');

  const service = await createServiceClient();

  const { data: created, error: authError } = await service.auth.admin.createUser(
    email ? { email, email_confirm: true } : { phone: phone!, phone_confirm: true }
  );

  if (authError || !created.user) {
    console.error('[api/users/invite] auth user creation failed:', authError?.message);
    return serverError('יצירת המשתמש נכשלה');
  }

  const { data: profile, error: profileError } = await service
    .from('users')
    .insert({
      id: created.user.id,
      email: email ?? null,
      phone: phone ?? null,
      full_name: body.fullName?.trim() || null,
      app_role: role,
      is_active: true,
      is_managed: false,
      invited_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (profileError) {
    // Roll back so the address is not left occupied by a login with no profile,
    // which would make a retry fail with "already exists" forever.
    await service.auth.admin.deleteUser(created.user.id);
    console.error('[api/users/invite] profile insert failed:', profileError.message);
    return serverError('יצירת המשתמש נכשלה');
  }

  return NextResponse.json({ user: profile });
}
