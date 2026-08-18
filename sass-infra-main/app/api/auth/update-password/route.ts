import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, notFound, unauthorized } from '@/lib/api/auth';
import { isPasswordEnabled } from '@/lib/auth/methods';

/**
 * Sets a new password for the signed-in user.
 *
 * Reached in two ways: from the reset link (where the recovery token has
 * already established a session) and from the profile page.
 *
 * Off when the deployment does not run password sign-in — see
 * /api/auth/forgot-password for the reasoning.
 */
export async function POST(request: NextRequest) {
  if (!isPasswordEnabled()) return notFound();

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  const password = body.password;
  if (!password) return badRequest('נא להזין סיסמה חדשה');
  if (password.length < 8) return badRequest('הסיסמה חייבת להכיל לפחות 8 תווים');

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized('קישור האיפוס פג תוקף. בקש קישור חדש.');

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return NextResponse.json({ error: 'עדכון הסיסמה נכשל' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
