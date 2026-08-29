import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase client for the MASTER project, acting as a signed-in operator.
 *
 * ── WHY THE MASTER PROJECT HOLDS OPERATOR IDENTITY ───────────────────────────
 * Everything else in this codebase authenticates against the *current tenant's*
 * project, because that is where the users are. The backoffice cannot: it has
 * to work on the apex domain, where no tenant resolves and there is no project
 * to authenticate against. It also should not — managing the platform would
 * otherwise require an account inside a customer's database.
 *
 * So operators sign in against the master project instead. Two consequences
 * worth knowing:
 *
 *   · Session cookies do not collide with a tenant's. Supabase names them
 *     `sb-<project-ref>-auth-token`, and the master's ref differs from every
 *     tenant's, so an operator can be signed into the backoffice and into a
 *     tenant app in the same browser.
 *   · There is no `public.users` table here and no role column. Authorization
 *     is the `PLATFORM_OPERATOR_EMAILS` allow-list, checked in
 *     lib/auth/platform.ts. The master registry deliberately stays one table.
 *
 * This is the ANON key, not the service key: it carries a user session and RLS
 * applies. `master-client.ts` remains the service-role client for registry
 * reads and writes, and the two must not be confused.
 */

export function hasMasterAuthConfig(): boolean {
  return !!(process.env.MASTER_SUPABASE_URL && process.env.MASTER_SUPABASE_ANON_KEY);
}

function masterAuthCredentials(): { url: string; key: string } {
  const url = process.env.MASTER_SUPABASE_URL;
  const key = process.env.MASTER_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'MASTER_SUPABASE_URL and MASTER_SUPABASE_ANON_KEY must be set for the backoffice sign-in.'
    );
  }

  return { url, key };
}

/**
 * Per-request client. Never hoisted: it carries one operator's session.
 */
export async function createMasterAuthClient() {
  const cookieStore = await cookies();
  const { url, key } = masterAuthCredentials();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component, which cannot set cookies. Safe:
          // the session is refreshed on the next route handler that runs.
        }
      },
    },
  });
}

/**
 * The signed-in operator's email, or null.
 *
 * Returns null rather than throwing when the master auth vars are absent, so a
 * deployment that never configured the backoffice simply has no operator
 * session rather than 500s on every admin route.
 */
export async function getMasterUserEmail(): Promise<string | null> {
  if (!hasMasterAuthConfig()) return null;

  try {
    const supabase = await createMasterAuthClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.email ?? null;
  } catch {
    return null;
  }
}
