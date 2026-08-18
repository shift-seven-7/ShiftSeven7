import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import type { Database } from '@/types/database.types';
import { LOCAL_TENANT_ID } from '@/lib/tenant/local';

/**
 * Supabase client for the current tenant with the SERVICE ROLE key — bypasses
 * RLS entirely.
 *
 * Use only where RLS genuinely cannot express the operation: creating auth
 * users during an invite, provisioning, cross-user admin writes. Everywhere
 * else use lib/supabase/server.ts and let RLS do its job.
 *
 * The service key is never passed through headers. It is fetched from the
 * master registry (where it lives encrypted) using the tenant id the proxy
 * injected, and decrypted server-side per request.
 */
export async function createServiceClient() {
  const headersList = await headers();
  const tenantId = headersList.get('x-tenant-id');

  if (!tenantId) {
    throw new Error(
      'Tenant id missing. A service client can only be created on a request that passed through proxy.ts.'
    );
  }

  // Local development: the whole stack is one Supabase project.
  if (tenantId === LOCAL_TENANT_ID) {
    const url = process.env.LOCAL_TENANT_SUPABASE_URL;
    const key = process.env.LOCAL_TENANT_SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error(
        'Local tenant is active but LOCAL_TENANT_SUPABASE_URL / LOCAL_TENANT_SUPABASE_SERVICE_KEY are not set.'
      );
    }
    return createSupabaseClient<Database>(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  // Imported lazily so the master client (and its service credentials) is not
  // pulled into bundles that only ever need the user-scoped client.
  const { getTenantById } = await import('@/lib/supabase/master-client');
  const tenant = await getTenantById(tenantId);

  if (!tenant) throw new Error(`Tenant ${tenantId} not found in the registry.`);
  if (!tenant.supabase_service_role_key) {
    throw new Error(
      `Tenant ${tenant.subdomain} has no service-role key stored. Add it in the admin console.`
    );
  }

  return createSupabaseClient<Database>(tenant.supabase_url, tenant.supabase_service_role_key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Service client for an ARBITRARY tenant, addressed by id.
 *
 * Only for genuinely cross-tenant work — provisioning, background jobs. Never
 * derive the id from user input on a tenant-scoped request; use the header.
 */
export async function createServiceClientForTenant(tenantId: string) {
  const { getTenantById } = await import('@/lib/supabase/master-client');
  const tenant = await getTenantById(tenantId);

  if (!tenant) throw new Error(`Tenant ${tenantId} not found in the registry.`);
  if (!tenant.supabase_service_role_key) {
    throw new Error(`Tenant ${tenant.subdomain} has no service-role key stored.`);
  }

  return createSupabaseClient<Database>(tenant.supabase_url, tenant.supabase_service_role_key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
