import type { TenantConnection } from '@/types/tenant.types';

/**
 * Per-process cache of tenant *connections*, so the proxy does not hit the
 * master registry on every request.
 *
 * ── WHAT IS AND IS NOT CACHED ────────────────────────────────────────────────
 * Only `TenantConnection` — id, subdomain, status, Supabase URL and anon key.
 * Those change essentially never. Mutable configuration (`settings`: logo,
 * modules, PDF branding, legal copy) is deliberately NOT cached; read it fresh
 * with `getTenantById`. That is what keeps an admin's save visible immediately
 * instead of up to a TTL later.
 *
 * ── THE ONE STALENESS WINDOW THAT REMAINS ────────────────────────────────────
 * Suspending a tenant, or rotating its keys, can take up to CACHE_TTL to take
 * effect — and on a serverless platform each instance holds its own copy, so
 * `invalidate()` only clears the instance that served the write. Redeploy if
 * you need it enforced everywhere at once.
 */

interface CacheEntry {
  connection: TenantConnection;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

const cache = new Map<string, CacheEntry>();

export function getCached(subdomain: string): TenantConnection | null {
  const entry = cache.get(subdomain);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(subdomain);
    return null;
  }
  return entry.connection;
}

export function setCached(subdomain: string, connection: TenantConnection): void {
  cache.set(subdomain, { connection, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Call after any write that changes status or credentials. */
export function invalidateTenantCache(subdomain: string): void {
  cache.delete(subdomain);
}

export function clearTenantCache(): void {
  cache.clear();
}

/** Cache-aside read. */
export async function getConnectionWithCache(
  subdomain: string,
  fetchFn: (subdomain: string) => Promise<TenantConnection | null>
): Promise<TenantConnection | null> {
  const cached = getCached(subdomain);
  if (cached) return cached;

  const connection = await fetchFn(subdomain);
  if (connection) setCached(subdomain, connection);
  return connection;
}
