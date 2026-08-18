/**
 * The contract every sign-in method implements.
 *
 * ── WHY A REGISTRY ───────────────────────────────────────────────────────────
 * Which method a deployment uses is a deployment decision, not a code decision.
 * One project ships email+password, the next ships phone OTP, and neither
 * should have to edit the login page, the API routes or the provisioning step
 * to get there. Everything that varies per method lives behind this interface;
 * everything else reads the registry.
 *
 * Split across two files on purpose:
 *
 *   · this file + `methods.ts` — descriptors only, safe to import from a
 *     client component (the login screen renders from them)
 *   · `lib/auth/server/*`      — the handlers, which touch Supabase and env
 *     secrets and must never reach the browser
 *
 * Adding a method is described in `docs/features/auth-methods.md`.
 */

export type AuthMethodId = 'password' | 'google' | 'email_otp' | 'phone_otp';

/** How the method behaves on screen, which decides the component that renders it. */
export type AuthMethodKind =
  /** identifier + secret, one request */
  | 'credentials'
  /** leaves for a provider and comes back through /auth/callback */
  | 'oauth'
  /** two steps: send a code, then verify it */
  | 'otp';

/** Which column on `public.users` this method establishes identity through. */
export type IdentifierKind = 'email' | 'phone' | 'none';

export interface AuthMethodDescriptor {
  id: AuthMethodId;
  /** Hebrew, shown on the login screen. */
  label: string;
  kind: AuthMethodKind;
  identifier: IdentifierKind;
  /**
   * false = the seam exists but the body does not. Enabling the method still
   * renders it, and the server answers 501 with `todo` as the message, so a
   * half-configured deployment fails loudly instead of silently accepting
   * logins it cannot complete.
   */
  implemented: boolean;
  /** Whether self-registration is possible through this method. */
  supportsSignUp: boolean;
  /** Env vars the method needs before it can work at all. */
  requiredEnv: readonly string[];
  /** What is left to do, for an unimplemented method. Surfaced to the caller. */
  todo?: string;
}

// ─── server-side shapes ──────────────────────────────────────────────────────

export interface AuthStartInput {
  /** Email address or phone number, depending on `descriptor.identifier`. */
  identifier?: string;
  password?: string;
  fullName?: string;
  /** Browser origin, validated against the allow-list before use. */
  origin?: string;
  /** Relative path to land on afterwards. */
  next?: string;
  mode: 'sign-in' | 'sign-up';
}

export interface AuthVerifyInput {
  identifier: string;
  code: string;
}

export type AuthResult =
  /** Signed in; session cookies are already on the response. */
  | { outcome: 'session' }
  /** Client must navigate here (OAuth). */
  | { outcome: 'redirect'; url: string }
  /** A code was sent; the client should collect it and call `verify`. */
  | { outcome: 'pending_verification'; channel: IdentifierKind }
  /** A confirmation link was sent; nothing more to do in this tab. */
  | { outcome: 'pending_confirmation' };

export interface AuthHandlerContext {
  /** Tenant-scoped client, already bound to the request's cookies. */
  supabase: import('@supabase/supabase-js').SupabaseClient<
    import('@/types/database.types').Database
  >;
  /** Validated origin for building redirect URLs. */
  baseUrl: string;
}

/**
 * The auth section of Supabase's Management API project config. Each enabled
 * method contributes its own fields during provisioning step 4, so a tenant
 * project is configured for exactly the methods the deployment runs.
 */
export interface AuthProjectConfig {
  site_url: string;
  uri_allow_list: string;
  [key: string]: string | boolean | number | undefined;
}

export interface AuthMethodHandler {
  start(input: AuthStartInput, ctx: AuthHandlerContext): Promise<AuthResult>;
  /** OTP methods only. */
  verify?(input: AuthVerifyInput, ctx: AuthHandlerContext): Promise<AuthResult>;
  /**
   * Contributes provider settings to a new tenant project. Mutates `config`.
   * Throwing here fails provisioning step 4 with the thrown message — which is
   * what an unimplemented method should do rather than create a tenant nobody
   * can sign in to.
   */
  configureProject?(config: AuthProjectConfig): void;
}

/**
 * An auth failure with a caller-facing Hebrew message and the status to answer
 * with. Anything else that escapes a handler becomes a generic 500.
 */
export class AuthMethodError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = 'AuthMethodError';
  }
}
