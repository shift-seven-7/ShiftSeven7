import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

/**
 * Supabase client for the BROWSER, scoped to the current tenant.
 *
 * Credentials come from `window.__TENANT_CREDENTIALS__`, which
 * components/providers/TenantProvider.tsx sets during render — before any
 * child hydrates — from the headers the proxy injected.
 *
 * Data fetching does NOT go through this client. Everything reads and writes
 * via /api/* routes with TanStack Query (see the `tanstack-query` skill). This
 * exists for the pieces that must run in the browser: the auth session
 * listener and OAuth redirects.
 */

interface TenantCredentials {
  tenantId: string;
  subdomain: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

declare global {
  interface Window {
    __TENANT_CREDENTIALS__?: TenantCredentials;
  }
}

let cachedClient: ReturnType<typeof createBrowserClient<Database>> | null = null;
let cachedTenantId: string | null = null;

export function getTenantCredentials(): TenantCredentials | null {
  if (typeof window === 'undefined') return null;
  return window.__TENANT_CREDENTIALS__ ?? null;
}

export function createClient() {
  const credentials = getTenantCredentials();

  if (!credentials) {
    // A tenant page cannot function without credentials; the apex/error pages
    // legitimately have none, so do not bounce those.
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path !== '/' && !path.startsWith('/tenant-')) {
        window.location.href = '/tenant-not-found';
      }
    }
    throw new Error(
      'No tenant credentials on this page. Open the app on a tenant subdomain (e.g. acme.localhost:3000).'
    );
  }

  // One client per tenant. The id changes only if the page is reused across
  // tenants, which does not happen in practice — but caching on it is free.
  if (cachedClient && cachedTenantId === credentials.tenantId) {
    return cachedClient;
  }

  cachedTenantId = credentials.tenantId;
  cachedClient = createBrowserClient<Database>(
    credentials.supabaseUrl,
    credentials.supabaseAnonKey
  );
  return cachedClient;
}
