import type { TenantConnection } from '@/types/tenant.types';

/**
 * Local-development bypass.
 *
 * Lets you run the whole app against a single local Supabase stack with no
 * master registry and no cloud project. When USE_LOCAL_DB is set the master
 * client already points at the local stack, so the registry resolves the tenant
 * normally and this bypass stays out of the way.
 *
 * The bypass proper is for the other local mode: pointing at ONE remote tenant
 * project directly, without a master registry.
 */

/** Synthetic tenant id used whenever the registry is bypassed. */
export const LOCAL_TENANT_ID = 'local-tenant';

export function isLocalTenant(tenantId: string | null | undefined): boolean {
  return tenantId === LOCAL_TENANT_ID;
}

/**
 * A synthetic connection built from LOCAL_TENANT_* env vars, or null when the
 * bypass does not apply.
 */
export function getLocalTenantConnection(subdomain: string | null): TenantConnection | null {
  // USE_LOCAL_DB means "the local stack IS the master" — let the normal
  // registry lookup happen so local behaviour matches production.
  if (process.env.USE_LOCAL_DB === 'true') return null;

  const localSubdomain = process.env.LOCAL_TENANT_SUBDOMAIN;
  const url = process.env.LOCAL_TENANT_SUPABASE_URL;
  const anonKey = process.env.LOCAL_TENANT_SUPABASE_ANON_KEY;

  if (!localSubdomain || !url || !anonKey) return null;
  if (subdomain !== localSubdomain) return null;

  return {
    id: LOCAL_TENANT_ID,
    subdomain: localSubdomain,
    status: 'active',
    supabase_url: url,
    supabase_anon_key: anonKey,
  };
}
