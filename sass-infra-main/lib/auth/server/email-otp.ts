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
 * Email one-time code / magic link — PLACEHOLDER.
 *
 * The cheapest method to finish: no external provider, no per-message cost —
 * it rides the same mailer the password reset already uses. It is left
 * unimplemented only because a foundation should not guess whether a project
 * wants passwordless email.
 *
 * To implement, fill in the two bodies below (the sketches are complete) and
 * set `implemented: true` in `lib/auth/methods.ts`. Everything else — the
 * two-step OTP form, the routes, provisioning — already handles it.
 *
 * Note the SMTP caveat: Supabase's built-in mailer is rate-limited to a
 * handful of messages an hour and is not meant for production. A real
 * deployment configures a custom SMTP provider in the tenant project, which is
 * what `configureProject` below is for.
 *
 * Full walkthrough: docs/features/auth-methods.md
 */

function notImplemented(): never {
  throw new AuthMethodError(AUTH_METHODS.email_otp.todo!, 501);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function start(_input: AuthStartInput, _ctx: AuthHandlerContext): Promise<AuthResult> {
  notImplemented();

  /* ─────────────────────────────────────────────────────────────────────────
  const email = _input.identifier?.trim().toLowerCase();
  if (!email) throw new AuthMethodError('נא להזין כתובת אימייל');

  const { error } = await _ctx.supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: _input.mode === 'sign-up',
      emailRedirectTo: `${_ctx.baseUrl}/auth/callback`,
    },
  });

  if (error) throw new AuthMethodError('שליחת הקוד נכשלה. נסה שוב.');
  return { outcome: 'pending_verification', channel: 'email' };
  ────────────────────────────────────────────────────────────────────────── */
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function verify(_input: AuthVerifyInput, _ctx: AuthHandlerContext): Promise<AuthResult> {
  notImplemented();

  /* ─────────────────────────────────────────────────────────────────────────
  const { data, error } = await _ctx.supabase.auth.verifyOtp({
    email: _input.identifier.trim().toLowerCase(),
    token: _input.code,
    type: 'email',
  });

  if (error || !data.user) throw new AuthMethodError('הקוד שגוי או שפג תוקפו', 401);
  await ensureUserProfile(_ctx.supabase, data.user);
  return { outcome: 'session' };
  ────────────────────────────────────────────────────────────────────────── */
}

function configureProject(config: AuthProjectConfig): void {
  config.external_email_enabled = true;

  /* Custom SMTP, once you have a provider:
  config.smtp_host = process.env.SMTP_HOST;
  config.smtp_port = process.env.SMTP_PORT;
  config.smtp_user = process.env.SMTP_USER;
  config.smtp_pass = process.env.SMTP_PASS;
  config.smtp_sender_name = process.env.SMTP_SENDER_NAME;
  */
}

export const emailOtpHandler: AuthMethodHandler = { start, verify, configureProject };
