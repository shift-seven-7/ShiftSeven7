import {
  AuthMethodError,
  type AuthHandlerContext,
  type AuthMethodHandler,
  type AuthProjectConfig,
  type AuthResult,
  type AuthStartInput,
} from '../types';

/**
 * Google OAuth.
 *
 * Returns the provider URL instead of redirecting: following the redirect
 * server-side would lose the PKCE verifier cookie that /auth/callback needs to
 * complete the exchange. The browser does the navigating.
 *
 * Each tenant's Supabase project carries its own OAuth configuration —
 * `configureProject` below is what the provisioning wizard writes.
 */

async function start(
  input: AuthStartInput,
  { supabase, baseUrl }: AuthHandlerContext
): Promise<AuthResult> {
  const callback = new URL('/auth/callback', baseUrl);
  // Only relative paths — an absolute `next` would be an open redirect.
  if (input.next?.startsWith('/')) {
    callback.searchParams.set('next', input.next);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    throw new AuthMethodError('ההתחברות נכשלה. נסה שוב.', 500);
  }

  return { outcome: 'redirect', url: data.url };
}

function configureProject(config: AuthProjectConfig): void {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !secret) {
    throw new Error(
      'התחברות עם Google מופעלת אך GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET אינם מוגדרים. ' +
        'הגדר אותם, או הסר את google מ-NEXT_PUBLIC_AUTH_METHODS.'
    );
  }

  config.external_google_enabled = true;
  config.external_google_client_id = clientId;
  config.external_google_secret = secret;
}

export const googleHandler: AuthMethodHandler = { start, configureProject };
