import { maskSecret } from '@/lib/crypto/secrets';
import type { Tenant } from '@/types/tenant.types';

/**
 * The browser-safe projection of a tenant.
 *
 * Every handler under app/api/admin/tenants/** declares this as its response
 * type, so returning a raw `Tenant` — which carries the plaintext service-role
 * key — is a compile error rather than a silent leak. The admin edit form
 * treats keys as write-only: an empty field means "leave unchanged".
 */
export type TenantPublic = Omit<Tenant, 'supabase_anon_key' | 'supabase_service_role_key'> & {
  /** Enough to tell two keys apart, not enough to use one. */
  supabase_anon_key_masked: string;
  has_service_role_key: boolean;
};

export function toTenantPublic(tenant: Tenant): TenantPublic {
  const {
    supabase_anon_key: anonKey,
    supabase_service_role_key: serviceKey,
    ...rest
  } = tenant;

  return {
    ...rest,
    supabase_anon_key_masked: maskSecret(anonKey),
    has_service_role_key: !!serviceKey,
  };
}
