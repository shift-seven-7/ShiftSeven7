import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import type { Database } from '@/types/database.types';

/**
 * Supabase client for the CURRENT TENANT, acting as the signed-in user.
 *
 * This is the default client for API routes: it carries the user's session, so
 * RLS applies. Reach for lib/supabase/service.ts only when an operation must
 * legitimately bypass RLS.
 *
 * Credentials come from headers the proxy injected. A request that did not pass
 * through the proxy has no tenant, and this throws rather than falling back to
 * some default project.
 */

async function getTenantCredentials(): Promise<{ url: string; key: string }> {
  const headersList = await headers();

  const url = headersList.get('x-supabase-url');
  const key = headersList.get('x-supabase-anon-key');

  if (!url || !key) {
    throw new Error(
      'Missing tenant credentials in request headers. The request did not pass through proxy.ts.'
    );
  }

  return { url, key };
}

/**
 * Create a per-request client. Never hoist this into a module-level variable:
 * on fluid/serverless runtimes one instance serves many tenants.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = await getTenantCredentials();

  return createServerClient<Database>(url, key, {
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
          // Called from a Server Component — safe to ignore, the proxy already
          // refreshed the session cookies on this request.
        }
      },
    },
  });
}
