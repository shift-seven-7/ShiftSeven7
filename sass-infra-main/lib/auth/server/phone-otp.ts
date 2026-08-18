import { AUTH_METHODS } from '../methods';
import {
  AuthMethodError,
  type AuthHandlerContext,
  type AuthMethodHandler,
  type AuthProjectConfig,
  type AuthResult,
  type AuthStartInput,
  type AuthVerifyInput,
} from '../types';

/**
 * Phone (SMS) one-time code — PLACEHOLDER.
 *
 * ── WHY IT IS NOT IMPLEMENTED ────────────────────────────────────────────────
 * Not because the code is hard — `start` and `verify` below are about fifteen
 * lines. Because it cannot work without a paid SMS provider, and choosing one
 * is the deployment's decision, not the boilerplate's. Shipping a stub that
 * silently does nothing would be worse than shipping this.
 *
 * Everything around the method is already in place. What is missing is only
 * what is inside this file plus an account with a provider.
 *
 * ── THE FIVE SEAMS ───────────────────────────────────────────────────────────
 *
 *  1. CHOOSE — `NEXT_PUBLIC_AUTH_METHODS=phone_otp`.
 *     Nothing to write. The login screen already renders an OTP form for any
 *     method whose `kind` is 'otp' (components/auth/methods/OtpForm.tsx).
 *
 *  2. IMPLEMENT — this file. Delete the two `notImplemented()` calls and use
 *     the bodies sketched below. Supabase does the code generation, storage
 *     and expiry; you are only calling it.
 *
 *  3. SMS PROVIDER — the part that costs money and takes days. Open a Twilio /
 *     Vonage / MessageBird account, register a sender (Israeli numbers need an
 *     approved alphanumeric sender or a local long code), then set the env
 *     vars listed in `AUTH_METHODS.phone_otp.requiredEnv` and fill in
 *     `configureProject` below so every newly provisioned tenant project gets
 *     the provider configured automatically.
 *
 *  4. LOCAL DEV — `supabase/config.toml` ships with SMS off:
 *       [auth.sms]        enable_signup = false
 *       [auth.sms.twilio] enabled = false
 *     Turn them on, or add a `[auth.sms.test_otp]` entry to sign in with a
 *     fixed code and no provider at all. Restart with `npm run db:stop && npm run db:start`.
 *
 *  5. INVITATIONS — `app/api/users/invite/route.ts` invites by channel. It
 *     already refuses a phone invite while this method is unimplemented; once
 *     it is, the phone branch there starts working with no further change.
 *
 * The identity schema is NOT a seam you need to touch: `public.users.email` is
 * nullable and `phone` is unique, so a phone-only account is representable
 * today. See `supabase/migrations/20260101000000_baseline.sql`.
 *
 * Full walkthrough: docs/features/auth-methods.md
 */

function notImplemented(): never {
  throw new AuthMethodError(AUTH_METHODS.phone_otp.todo!, 501);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function start(_input: AuthStartInput, _ctx: AuthHandlerContext): Promise<AuthResult> {
  notImplemented();

  /* ── seam 2, part one: send the code ──────────────────────────────────────
  const phone = normalisePhone(_input.identifier);   // E.164, e.g. +9725...
  if (!phone) throw new AuthMethodError('נא להזין מספר טלפון תקין');

  const { error } = await _ctx.supabase.auth.signInWithOtp({
    phone,
    // shouldCreateUser: false turns this into sign-in-only, which is what an
    // invite-only deployment wants.
    options: { shouldCreateUser: _input.mode === 'sign-up' },
  });

  // Vague on purpose, exactly like the password method: a distinct "no such
  // number" reply is an enumeration oracle.
  if (error) throw new AuthMethodError('שליחת הקוד נכשלה. נסה שוב.');

  return { outcome: 'pending_verification', channel: 'phone' };
  ────────────────────────────────────────────────────────────────────────── */
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function verify(_input: AuthVerifyInput, _ctx: AuthHandlerContext): Promise<AuthResult> {
  notImplemented();

  /* ── seam 2, part two: verify it ──────────────────────────────────────────
  const phone = normalisePhone(_input.identifier);
  if (!phone) throw new AuthMethodError('נא להזין מספר טלפון תקין');

  const { data, error } = await _ctx.supabase.auth.verifyOtp({
    phone,
    token: _input.code,
    type: 'sms',
  });

  if (error || !data.user) throw new AuthMethodError('הקוד שגוי או שפג תוקפו', 401);

  // Same deactivation check the password method runs — Supabase knows nothing
  // about `is_active`.
  const { data: profile } = await _ctx.supabase
    .from('users').select('is_active').eq('id', data.user.id).maybeSingle();
  if (profile && profile.is_active === false) {
    await _ctx.supabase.auth.signOut();
    throw new AuthMethodError('החשבון שלך הושבת. פנה למנהל המערכת.', 403);
  }

  // First sign-in through a phone number has no profile row yet.
  await ensureUserProfile(_ctx.supabase, data.user);

  return { outcome: 'session' };
  ────────────────────────────────────────────────────────────────────────── */
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function configureProject(_config: AuthProjectConfig): void {
  // Deliberately fatal. Provisioning a tenant with phone sign-in enabled but no
  // SMS provider produces a project nobody can sign in to, and the failure
  // would only surface at a customer's first login.
  throw new Error(
    'התחברות ב-SMS מופעלת אך אינה מוטמעת. ' +
      `נדרש ספק SMS ומשתני הסביבה: ${AUTH_METHODS.phone_otp.requiredEnv.join(', ')}. ` +
      'ראה lib/auth/server/phone-otp.ts, סעיף 3.'
  );

  /* ── seam 3: what to write once a provider exists ─────────────────────────
  _config.external_phone_enabled = true;
  _config.sms_provider = process.env.SMS_PROVIDER;                       // 'twilio'
  _config.sms_twilio_account_sid = process.env.SMS_TWILIO_ACCOUNT_SID;
  _config.sms_twilio_auth_token = process.env.SMS_TWILIO_AUTH_TOKEN;
  _config.sms_twilio_message_service_sid = process.env.SMS_TWILIO_MESSAGE_SERVICE_SID;
  _config.sms_otp_exp = 600;
  ────────────────────────────────────────────────────────────────────────── */
}

export const phoneOtpHandler: AuthMethodHandler = { start, verify, configureProject };
