/**
 * The sign-in method registry — descriptors only, no implementations.
 *
 * Client-safe by construction: the login screen imports this to know what to
 * render. The handlers live in `lib/auth/server/` and never cross into a
 * browser bundle.
 *
 * ── CHOOSING METHODS ─────────────────────────────────────────────────────────
 * One env var, set once per deployment:
 *
 *     NEXT_PUBLIC_AUTH_METHODS=password              # the default
 *     NEXT_PUBLIC_AUTH_METHODS=password,google
 *     NEXT_PUBLIC_AUTH_METHODS=phone_otp
 *
 * It is NEXT_PUBLIC_ because the login screen has to render from it. That is
 * safe — the list of offered methods is not a secret, and the server checks it
 * again on every request rather than trusting what the client sent.
 */

import type { AuthMethodDescriptor, AuthMethodId, IdentifierKind } from './types';

export const AUTH_METHODS: Record<AuthMethodId, AuthMethodDescriptor> = {
  password: {
    id: 'password',
    label: 'אימייל וסיסמה',
    kind: 'credentials',
    identifier: 'email',
    implemented: true,
    supportsSignUp: true,
    requiredEnv: [],
  },

  google: {
    id: 'google',
    label: 'המשך עם Google',
    kind: 'oauth',
    identifier: 'email',
    implemented: true,
    supportsSignUp: true,
    // Read during provisioning (step 4), not at runtime: the tenant's own
    // Supabase project holds the configured provider.
    requiredEnv: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  },

  email_otp: {
    id: 'email_otp',
    label: 'קוד חד-פעמי באימייל',
    kind: 'otp',
    identifier: 'email',
    implemented: false,
    supportsSignUp: true,
    requiredEnv: [],
    todo:
      'התחברות בקוד חד-פעמי באימייל אינה מוטמעת. ' +
      'להטמעה: lib/auth/server/email-otp.ts — signInWithOtp ו-verifyOtp עם type "email". ' +
      'ראה docs/features/auth-methods.md',
  },

  phone_otp: {
    id: 'phone_otp',
    label: 'קוד חד-פעמי ב-SMS',
    kind: 'otp',
    identifier: 'phone',
    implemented: false,
    supportsSignUp: true,
    // Supabase does not send SMS itself — it relays through a provider you pay
    // for and configure per tenant project.
    requiredEnv: [
      'SMS_PROVIDER',
      'SMS_TWILIO_ACCOUNT_SID',
      'SMS_TWILIO_AUTH_TOKEN',
      'SMS_TWILIO_MESSAGE_SERVICE_SID',
    ],
    todo:
      'התחברות ב-SMS אינה מוטמעת. ' +
      'להטמעה: lib/auth/server/phone-otp.ts — signInWithOtp ו-verifyOtp עם type "sms", ' +
      'בתוספת ספק SMS בתשלום (Twilio/Vonage) והגדרתו במשתני הסביבה. ' +
      'ראה docs/features/auth-methods.md',
  },
};

export const ALL_AUTH_METHOD_IDS = Object.keys(AUTH_METHODS) as AuthMethodId[];

export function isAuthMethodId(value: unknown): value is AuthMethodId {
  return typeof value === 'string' && value in AUTH_METHODS;
}

/** The default when the env var is unset — the one method that needs no setup. */
const DEFAULT_METHODS: AuthMethodId[] = ['password'];

function parseEnabled(): AuthMethodId[] {
  const raw = process.env.NEXT_PUBLIC_AUTH_METHODS;
  if (!raw?.trim()) return DEFAULT_METHODS;

  const ids = raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .filter(isAuthMethodId);

  // An empty or entirely misspelled list would lock everyone out. Falling back
  // beats a login screen with no way in.
  if (ids.length === 0) {
    console.warn(
      `[auth] NEXT_PUBLIC_AUTH_METHODS="${raw}" matched no known method; ` +
        `falling back to ${DEFAULT_METHODS.join(',')}. ` +
        `Known: ${ALL_AUTH_METHOD_IDS.join(', ')}`
    );
    return DEFAULT_METHODS;
  }

  // Preserve registry order rather than the env var's, so the screen looks the
  // same however the list was written.
  return ALL_AUTH_METHOD_IDS.filter((id) => ids.includes(id));
}

const ENABLED_IDS = parseEnabled();

export function getEnabledMethodIds(): AuthMethodId[] {
  return ENABLED_IDS;
}

export function getEnabledMethods(): AuthMethodDescriptor[] {
  return ENABLED_IDS.map((id) => AUTH_METHODS[id]);
}

export function isMethodEnabled(id: AuthMethodId): boolean {
  return ENABLED_IDS.includes(id);
}

/** Password-only concerns (forgot/reset) are hidden when no password method runs. */
export function isPasswordEnabled(): boolean {
  return isMethodEnabled('password');
}

/** True when at least one enabled method can create a new account. */
export function isSignUpAvailable(): boolean {
  return getEnabledMethods().some((m) => m.implemented && m.supportsSignUp);
}

/**
 * Which identifiers an admin can invite by.
 *
 * Inviting someone by email on a phone-OTP deployment creates an account they
 * can never sign in to, so the invite form and the invite route both read this
 * rather than assuming email.
 *
 * Only implemented methods count — a placeholder cannot receive anyone.
 */
export function getInviteChannels(): IdentifierKind[] {
  const channels = new Set<IdentifierKind>();
  for (const method of getEnabledMethods()) {
    if (method.implemented && method.identifier !== 'none') {
      channels.add(method.identifier);
    }
  }
  return [...channels];
}
