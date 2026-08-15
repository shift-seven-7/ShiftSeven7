import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Server-side Supabase client for Server Components, Server Actions, and
 * Route Handlers. Create a new instance per request - never share/cache one.
 *
 * setAll can throw when called from a Server Component (cookies are
 * read-only there); that's fine as long as proxy.ts is refreshing the
 * session on every request, which is where the actual cookie writes happen.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component - proxy.ts refreshes the
            // session instead, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/**
 * Server-side Supabase client using the service-role key - bypasses RLS
 * entirely. Only ever use this in trusted server code (admin provisioning,
 * the cron route) that does its own authorization checks. Never expose the
 * service-role key to the client.
 */
export function createServiceRoleClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
