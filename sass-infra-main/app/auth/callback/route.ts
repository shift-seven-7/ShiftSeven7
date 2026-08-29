import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { HOME_PAGES, PENDING_APPROVAL_ROUTE } from '@/lib/constants/permissions';
import { isUserRole } from '@/types/roles';
import { ensureUserProfile } from '@/lib/api/ensure-profile';
import type { Database } from '@/types/database.types';

/**
 * OAuth / email-confirmation callback.
 *
 * Exchanges the code for a session, makes sure a `public.users` row exists, and
 * sends the user to the right landing page.
 *
 * This runs before the app shell exists, so it reads the tenant credentials
 * straight off the proxy's headers rather than through lib/supabase/server.ts.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  const supabaseUrl = request.headers.get('x-supabase-url');
  const supabaseKey = request.headers.get('x-supabase-anon-key');

  if (!supabaseUrl || !supabaseKey) {
    console.error('[auth/callback] no tenant credentials on the request');
    return NextResponse.redirect(new URL('/tenant-not-found', request.url));
  }

  // Behind a tunnel or a proxy the request URL's origin is not the origin the
  // browser is on; the forwarded headers are.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const redirectTo = (path: string) =>
    forwardedHost ? `${forwardedProto}://${forwardedHost}${path}` : `${origin}${path}`;

  if (!code) {
    return NextResponse.redirect(redirectTo('/auth/error'));
  }

  // The session cookies are collected rather than written directly: the final
  // response object does not exist yet, and writing to a response we later
  // replace would silently drop the session.
  const pendingCookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
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
    console.error('[auth/callback] code exchange failed:', error?.message);
    return NextResponse.redirect(redirectTo('/auth/error'));
  }

  const user = data.session.user;

  // A client bound to the fresh access token, so the profile read and write go
  // through RLS as this user rather than as an anonymous caller.
  const asUser = createClient<Database>(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });

  const { data: profile } = await asUser
    .from('users')
    .select('app_role, is_active, invited_at')
    .eq('id', user.id)
    .maybeSingle();

  let landing: string;

  if (profile) {
    if (profile.is_active === false) {
      await supabase.auth.signOut();
      return NextResponse.redirect(redirectTo('/auth/login?disabled=1'));
    }

    // First successful login clears the "invited, never signed in" marker.
    if (profile.invited_at) {
      await asUser.from('users').update({ invited_at: null }).eq('id', user.id);
    }

    landing = isUserRole(profile.app_role)
      ? HOME_PAGES[profile.app_role]
      : PENDING_APPROVAL_ROUTE;
  } else {
    // First sight of this user: create the profile with NO role. An admin
    // assigns one from the users page; until then they see the waiting screen.
    // Shared with /api/auth/signup so the two entry points cannot drift.
    await ensureUserProfile(asUser, user).catch((error) => {
      console.error('[auth/callback]', error);
    });

    landing = PENDING_APPROVAL_ROUTE;
  }

  // Honour ?next only when it is a relative path — an absolute one would make
  // this an open redirect.
  const target = next?.startsWith('/') ? next : landing;

  const response = NextResponse.redirect(redirectTo(target));
  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );

  return response;
}
