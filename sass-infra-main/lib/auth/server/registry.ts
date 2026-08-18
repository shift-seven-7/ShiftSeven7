import { AUTH_METHODS, getEnabledMethodIds } from '../methods';
import type {
  AuthMethodDescriptor,
  AuthMethodHandler,
  AuthMethodId,
  AuthProjectConfig,
} from '../types';
import { passwordHandler } from './password';
import { googleHandler } from './google';
import { emailOtpHandler } from './email-otp';
import { phoneOtpHandler } from './phone-otp';

/**
 * Server side of the registry: descriptor → handler.
 *
 * Every handler reaches Supabase or reads a secret, so nothing under
 * `lib/auth/server/` may be imported from a component — enforced by the
 * `no-restricted-imports` block in eslint.config.mjs, the same way the rest of
 * the server-only modules here are. The client-safe half is `lib/auth/methods.ts`.
 */

const HANDLERS: Record<AuthMethodId, AuthMethodHandler> = {
  password: passwordHandler,
  google: googleHandler,
  email_otp: emailOtpHandler,
  phone_otp: phoneOtpHandler,
};

export interface ResolvedMethod {
  descriptor: AuthMethodDescriptor;
  handler: AuthMethodHandler;
}

export type MethodResolution =
  | { ok: true; method: ResolvedMethod }
  | { ok: false; status: number; message: string };

/**
 * Resolves a method id from a request path.
 *
 * The enabled-list check happens here rather than in the UI: the browser
 * decides what to *show*, the server decides what to *accept*. A disabled
 * method answers 404, not 403 — a deployment that does not offer phone sign-in
 * should not confirm that phone sign-in exists.
 */
export function resolveMethod(id: string): MethodResolution {
  if (!(id in AUTH_METHODS)) {
    return { ok: false, status: 404, message: 'שיטת התחברות לא מוכרת' };
  }

  const methodId = id as AuthMethodId;

  if (!getEnabledMethodIds().includes(methodId)) {
    return { ok: false, status: 404, message: 'שיטת התחברות לא מוכרת' };
  }

  const descriptor = AUTH_METHODS[methodId];

  if (!descriptor.implemented) {
    return {
      ok: false,
      status: 501,
      message: descriptor.todo ?? 'שיטת ההתחברות אינה מוטמעת',
    };
  }

  return { ok: true, method: { descriptor, handler: HANDLERS[methodId] } };
}

/**
 * Lets every enabled method contribute its provider settings to a new tenant
 * project — provisioning step 4.
 *
 * A method that cannot be configured throws, and the step fails. That is the
 * intent: better a visible failure during onboarding than a tenant whose users
 * discover at their first login that the provider was never set up.
 */
export function applyAuthMethodConfig(config: AuthProjectConfig): AuthProjectConfig {
  for (const id of getEnabledMethodIds()) {
    HANDLERS[id].configureProject?.(config);
  }
  return config;
}
