import { NextResponse, type NextRequest } from 'next/server';
import { badRequest, serverError } from '@/lib/api/auth';
import {
  createMasterAuthClient,
  getMasterUserEmail,
  hasMasterAuthConfig,
} from '@/lib/supabase/master-auth';
import { hasOperatorAllowList, isAllowedOperatorEmail } from '@/lib/auth/platform';
import { getBaseUrl } from '@/lib/utils';

/**
 * The backoffice session: who is signed in, how to sign in, how to sign out.
 *
 * Separate from /api/auth/* on purpose. That family authenticates against the
 * CURRENT TENANT's project through the sign-in-method registry; this one
 * authenticates against the master project, always with Google, and exists on
 * hosts where no tenant resolves at all.
 */

export interface BackofficeSession {
  /** The deployment has master auth configured at all. */
  configured: boolean;
  /** PLATFORM_OPERATOR_EMAILS is non-empty. Without it nobody can be admitted. */
  hasAllowList: boolean;
  email: string | null;
  /** Signed in AND on the allow-list. */
  authorized: boolean;
}

export async function GET() {
  const configured = hasMasterAuthConfig();
  const email = configured ? await getMasterUserEmail() : null;

  const session: BackofficeSession = {
    configured,
    hasAllowList: hasOperatorAllowList(),
    email,
    authorized: isAllowedOperatorEmail(email),
  };

  return NextResponse.json(session);
}

/** Starts the Google flow and hands the provider URL back for the browser to follow. */
export async function POST(request: NextRequest) {
  if (!hasMasterAuthConfig()) {
    return badRequest(
      'התחברות לבאק-אופיס אינה מוגדרת. חסרים MASTER_SUPABASE_URL / MASTER_SUPABASE_ANON_KEY.'
    );
  }

  let body: { origin?: string } = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine — the origin falls back to the request's own.
  }

  const baseUrl = getBaseUrl(request, body.origin);

  try {
    const supabase = await createMasterAuthClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${baseUrl}/backoffice/callback`,
        // Same reason as the tenant flow: following the redirect server-side
        // would lose the PKCE verifier cookie the callback needs.
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      console.error('[api/backoffice/session] OAuth start failed:', error?.message);
      return serverError('ההתחברות נכשלה. ודא ש-Google מופעל בפרויקט המאסטר.');
    }

    return NextResponse.json({ url: data.url });
  } catch (error) {
    console.error('[api/backoffice/session] OAuth start threw:', error);
    return serverError('ההתחברות נכשלה');
  }
}

export async function DELETE() {
  try {
    const supabase = await createMasterAuthClient();
    await supabase.auth.signOut();
  } catch {
    // Signing out of a session that is already gone is a success.
  }

  return NextResponse.json({ success: true });
}
