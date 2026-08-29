import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, notFound } from '@/lib/api/auth';
import { isPasswordEnabled } from '@/lib/auth/methods';
import { getBaseUrl } from '@/lib/utils';

/**
 * Sends a password-reset email.
 *
 * Always answers 200, whether or not the address exists — otherwise this
 * endpoint tells an attacker which emails have accounts on this tenant.
 *
 * Gated on the password method being enabled: a deployment that signs people
 * in with one-time codes has no password to reset, and leaving the endpoint
 * live would mail out reset links nobody can use.
 */
export async function POST(request: NextRequest) {
  if (!isPasswordEnabled()) return notFound();

  let body: { email?: string; origin?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) return badRequest('נא להזין אימייל');

  const supabase = await createClient();
  const baseUrl = getBaseUrl(request, body.origin);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl}/auth/update-password`,
  });

  if (error) {
    console.error('[auth] resetPasswordForEmail failed:', error.message);
  }

  return NextResponse.json({ success: true });
}
