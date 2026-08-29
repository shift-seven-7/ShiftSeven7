import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * OAuth callback for the backoffice — the master project's equivalent of
 * /auth/callback.
 *
 * Deliberately does NOT check the allow-list. Its job is to complete the code
 * exchange and set the session; whether that identity may do anything is
 * decided by `requireOperatorAccess` on every API call and reflected by
 * /api/backoffice/session on the screen. Refusing here instead would leave the
 * operator on an error page with no way to see *which* address they arrived as,
 * which is the single most useful thing to know when an allow-list rejects you.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // Behind a proxy the request URL's origin is not the browser's.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const redirectTo = (path: string) =>
    forwardedHost ? `${forwardedProto}://${forwardedHost}${path}` : `${origin}${path}`;

  if (!code) return NextResponse.redirect(redirectTo('/backoffice?error=missing_code'));

  const url = process.env.MASTER_SUPABASE_URL;
  const key = process.env.MASTER_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('[backoffice/callback] master auth is not configured');
    return NextResponse.redirect(redirectTo('/backoffice?error=not_configured'));
  }

  // Cookies are collected rather than written: the response object that will
  // carry them does not exist yet, and writing to one we later replace would
  // silently drop the session.
  const pendingCookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          pendingCookies.push({ name, value, options: options ?? {} })
        );
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('[backoffice/callback] code exchange failed:', error?.message);
    return NextResponse.redirect(redirectTo('/backoffice?error=exchange_failed'));
  }

  const response = NextResponse.redirect(redirectTo('/backoffice'));
  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );

  return response;
}
