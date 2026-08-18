import { listTenants } from '@/lib/supabase/master-client';

/**
 * The first-run gate.
 *
 * ── THE PROBLEM ──────────────────────────────────────────────────────────────
 * The tenant console lives at /app/admin/tenants — inside a tenant. Reaching it
 * means being an ADMIN on a tenant that already exists, so the FIRST tenant of a
 * deployment cannot be created through it. `npm run tenant:bootstrap` breaks
 * that cycle from the CLI; /bootstrap does the same from a browser.
 *
 * ── WHY IT IS GUARDED TWICE ──────────────────────────────────────────────────
 * This endpoint creates real, billable Supabase projects on the operator's
 * account. An unguarded version of it on a public URL is somebody else's free
 * infrastructure. So it needs BOTH:
 *
 *   1. `BOOTSTRAP_TOKEN` is set and matches   — opt-in, and proof of who you are
 *   2. the registry holds no tenants          — closes the window automatically
 *
 * Condition 2 alone would be tempting ("the window is only a few minutes") but
 * a window that opens the moment you deploy and closes when you get round to it
 * is not a window you control. Condition 1 alone would stay open forever.
 *
 * Fail-closed on a missing token: a deployment that never sets it never exposes
 * the route at all, which is the right default for the boilerplate.
 *
 * After the first tenant exists, remove `BOOTSTRAP_TOKEN` from the environment.
 * Nothing depends on it afterwards.
 */

export type BootstrapAvailability =
  | { available: true }
  | { available: false; reason: 'disabled' | 'already_provisioned' };

export async function getBootstrapAvailability(): Promise<BootstrapAvailability> {
  if (!process.env.BOOTSTRAP_TOKEN) {
    return { available: false, reason: 'disabled' };
  }

  // Counts every non-deleted tenant, so a soft-deleted first attempt does not
  // permanently lock the route.
  const tenants = await listTenants();
  if (tenants.length > 0) {
    return { available: false, reason: 'already_provisioned' };
  }

  return { available: true };
}

export function isBootstrapTokenValid(candidate: string | undefined): boolean {
  const expected = process.env.BOOTSTRAP_TOKEN;
  if (!expected || !candidate) return false;
  return timingSafeEqual(candidate, expected);
}

/**
 * Constant-time string comparison.
 *
 * Not `node:crypto` — this module is imported from a route that may be bundled
 * for either runtime, and a hand-rolled XOR loop has no such constraint. The
 * length is allowed to leak; the token's content is not.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
