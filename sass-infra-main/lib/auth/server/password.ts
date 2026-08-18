import { ensureUserProfile } from '@/lib/api/ensure-profile';
import {
  AuthMethodError,
  type AuthHandlerContext,
  type AuthMethodHandler,
  type AuthProjectConfig,
  type AuthResult,
  type AuthStartInput,
} from '../types';

/**
 * Email + password against the CURRENT TENANT's Supabase project.
 *
 * Auth users are per tenant: the same person on two tenants is two separate
 * accounts in two separate projects. There is no cross-tenant identity.
 */

const MIN_PASSWORD_LENGTH = 8;

async function start(
  input: AuthStartInput,
  { supabase, baseUrl }: AuthHandlerContext
): Promise<AuthResult> {
  const email = input.identifier?.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) {
    throw new AuthMethodError('נא להזין אימייל וסיסמה');
  }

  return input.mode === 'sign-up'
    ? signUp({ email, password, fullName: input.fullName?.trim(), supabase, baseUrl })
    : signIn({ email, password, supabase });
}

async function signIn({
  email,
  password,
  supabase,
}: {
  email: string;
  password: string;
  supabase: AuthHandlerContext['supabase'];
}): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    // Deliberately vague: distinguishing "no such user" from "wrong password"
    // turns the login form into an account-enumeration oracle.
    throw new AuthMethodError('אימייל או סיסמה שגויים', 401);
  }

  // A deactivated user can still authenticate — Supabase knows nothing about
  // `is_active`. Check the profile and drop the session if they are disabled.
  const { data: profile } = await supabase
    .from('users')
    .select('is_active')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profile && profile.is_active === false) {
    await supabase.auth.signOut();
    throw new AuthMethodError('החשבון שלך הושבת. פנה למנהל המערכת.', 403);
  }

  return { outcome: 'session' };
}

async function signUp({
  email,
  password,
  fullName,
  supabase,
  baseUrl,
}: {
  email: string;
  password: string;
  fullName?: string;
  supabase: AuthHandlerContext['supabase'];
  baseUrl: string;
}): Promise<AuthResult> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthMethodError(`הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${baseUrl}/auth/callback`,
      data: fullName ? { full_name: fullName } : undefined,
    },
  });

  if (error) {
    // Supabase returns the same shape whether or not the address exists, and
    // so do we — no account enumeration.
    throw new AuthMethodError('ההרשמה נכשלה. נסה שוב.');
  }

  // When email confirmation is disabled, signUp returns a live session and the
  // /auth/callback route never runs — so the profile has to be created here,
  // or the user ends up authenticated with no `public.users` row and locked out
  // of every API route.
  if (data.session && data.user) {
    await ensureUserProfile(supabase, data.user);
    return { outcome: 'session' };
  }

  return { outcome: 'pending_confirmation' };
}

function configureProject(config: AuthProjectConfig): void {
  // Supabase enables the email provider by default; being explicit means a
  // deployment that later drops password auth actually turns it off.
  config.external_email_enabled = true;
  config.mailer_autoconfirm = false;
}

export const passwordHandler: AuthMethodHandler = { start, configureProject };
