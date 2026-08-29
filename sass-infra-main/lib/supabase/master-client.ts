import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { MasterDatabase, TenantRow, TenantUpdate } from '@/types/master-database.types';
import type {
  CreateTenantInput,
  Tenant,
  TenantConnection,
  TenantListItem,
  UpdateTenantInput,
} from '@/types/tenant.types';
import { PLAN_LIMITS } from '@/types/tenant.types';
import {
  CURRENT_KEY_VERSION,
  decryptMaybe,
  encryptSecret,
  secretAad,
  tenantSecretAad,
} from '@/lib/crypto/secrets';

/**
 * The MASTER registry client — the one Supabase project that knows which
 * tenants exist and how to reach them.
 *
 * Server-only, service-role. Every read here decrypts the tenant's stored
 * Supabase keys; every write encrypts them. Callers deal in plaintext `Tenant`
 * and never see an envelope.
 *
 * A `Tenant` returned from this module must NOT be serialised to a browser —
 * pass it through `toTenantPublic()` from lib/tenant/serialize.ts first.
 */

type MasterClient = SupabaseClient<MasterDatabase>;

let masterClient: MasterClient | null = null;

function getMasterClient(): MasterClient {
  if (masterClient) return masterClient;

  const useLocalDb = process.env.USE_LOCAL_DB === 'true';

  // In local mode the single local Supabase stack plays both roles: it holds
  // the `tenants` registry and it is the tenant database.
  const url = useLocalDb
    ? process.env.LOCAL_TENANT_SUPABASE_URL
    : process.env.MASTER_SUPABASE_URL;
  const serviceKey = useLocalDb
    ? process.env.LOCAL_TENANT_SUPABASE_SERVICE_KEY
    : process.env.MASTER_SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      useLocalDb
        ? 'Missing local DB credentials. Set LOCAL_TENANT_SUPABASE_URL and LOCAL_TENANT_SUPABASE_SERVICE_KEY.'
        : 'Missing master configuration. Set MASTER_SUPABASE_URL and MASTER_SUPABASE_SERVICE_KEY.'
    );
  }

  masterClient = createClient<MasterDatabase>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return masterClient;
}

export function hasMasterConfig(): boolean {
  if (process.env.USE_LOCAL_DB === 'true') {
    return !!(
      process.env.LOCAL_TENANT_SUPABASE_URL && process.env.LOCAL_TENANT_SUPABASE_SERVICE_KEY
    );
  }
  return !!(process.env.MASTER_SUPABASE_URL && process.env.MASTER_SUPABASE_SERVICE_KEY);
}

// ─── encryption boundary ─────────────────────────────────────────────────────

/** Stored row → usable tenant. Decrypts both key columns. */
async function hydrate(row: TenantRow): Promise<Tenant> {
  const [anonKey, serviceKey] = await Promise.all([
    decryptMaybe(row.supabase_anon_key, secretAad(row.subdomain, 'anon')),
    decryptMaybe(row.supabase_service_role_key, secretAad(row.subdomain, 'service')),
  ]);

  // `secrets` is dropped rather than carried: a `Tenant` travels into API
  // responses, and the bag has no business being spread into one even as
  // ciphertext. Read it through getTenantSecret().
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { secrets: _secrets, ...rest } = row;

  return {
    ...rest,
    supabase_anon_key: anonKey,
    supabase_service_role_key: serviceKey,
    settings: row.settings ?? {},
  };
}

// ─── reads ───────────────────────────────────────────────────────────────────

/** Resolve a tenant from a request hostname. Only active tenants match. */
export async function getTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
  const { data, error } = await getMasterClient()
    .from('tenants')
    .select('*')
    .eq('subdomain', subdomain)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    console.error('[master] getTenantBySubdomain failed:', error);
    throw error;
  }
  return data ? hydrate(data) : null;
}

/**
 * The minimum needed to route a request and open a client for the tenant.
 *
 * This is what the proxy caches. Every field is effectively immutable for the
 * life of a tenant, so a cached copy cannot go stale in a way that matters —
 * unlike `settings`, which admins edit and which is therefore always read
 * fresh via `getTenantById`.
 */
export async function getTenantConnection(subdomain: string): Promise<TenantConnection | null> {
  const { data, error } = await getMasterClient()
    .from('tenants')
    .select('id, subdomain, status, supabase_url, supabase_anon_key')
    .eq('subdomain', subdomain)
    .in('status', ['active', 'suspended'])
    .maybeSingle();

  if (error) {
    console.error('[master] getTenantConnection failed:', error);
    throw error;
  }
  if (!data) return null;

  return {
    id: data.id,
    subdomain: data.subdomain,
    status: data.status,
    supabase_url: data.supabase_url,
    supabase_anon_key: await decryptMaybe(
      data.supabase_anon_key,
      secretAad(data.subdomain, 'anon')
    ),
  };
}

/** Any status — the admin console needs suspended and pending tenants too. */
export async function getTenantById(id: string): Promise<Tenant | null> {
  const { data, error } = await getMasterClient()
    .from('tenants')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[master] getTenantById failed:', error);
    throw error;
  }
  return data ? hydrate(data) : null;
}

// ─── the general secrets bag ─────────────────────────────────────────────────

/**
 * Reads one per-tenant secret, decrypted. Returns null when it was never set.
 *
 * This is where a project puts anything credential-shaped it needs per tenant —
 * an SMS provider token, a payment key, an integration secret. `settings` is
 * plaintext JSONB and must not hold any of it.
 */
export async function getTenantSecret(
  tenantId: string,
  key: string
): Promise<string | null> {
  const { data, error } = await getMasterClient()
    .from('tenants')
    .select('subdomain, secrets')
    .eq('id', tenantId)
    .maybeSingle();

  if (error) {
    console.error('[master] getTenantSecret failed:', error);
    throw error;
  }

  const sealed = data?.secrets?.[key];
  if (!data || !sealed) return null;

  return decryptMaybe(sealed, tenantSecretAad(data.subdomain, key));
}

/**
 * Writes one per-tenant secret, sealed. Passing null removes it.
 *
 * Read-modify-write on a JSONB column, so two concurrent writes to *different*
 * keys can lose one of them. That is acceptable for values an operator changes
 * by hand; a project that writes these from a hot path should move to a jsonb
 * merge (`secrets = secrets || $1`) via RPC.
 */
export async function setTenantSecret(
  tenantId: string,
  key: string,
  value: string | null
): Promise<void> {
  const client = getMasterClient();

  const { data, error: readError } = await client
    .from('tenants')
    .select('subdomain, secrets')
    .eq('id', tenantId)
    .maybeSingle();

  if (readError) throw readError;
  if (!data) throw new Error(`Tenant ${tenantId} not found`);

  const secrets = { ...(data.secrets ?? {}) };

  if (value === null) {
    delete secrets[key];
  } else {
    secrets[key] = await encryptSecret(value, tenantSecretAad(data.subdomain, key));
  }

  const { error } = await client.from('tenants').update({ secrets }).eq('id', tenantId);
  if (error) throw error;
}

/**
 * The raw stored row, keys still sealed. Only the rotation and migration
 * scripts should need this.
 */
export async function getTenantRowRaw(id: string): Promise<TenantRow | null> {
  const { data, error } = await getMasterClient()
    .from('tenants')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Tenant list for the admin table. The select list contains no key columns. */
export async function listTenants(): Promise<TenantListItem[]> {
  const { data, error } = await getMasterClient()
    .from('tenants')
    .select(
      'id, subdomain, name, name_he, status, plan_type, max_users, setup_status, created_at, updated_at'
    )
    .neq('status', 'deleted')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[master] listTenants failed:', error);
    throw error;
  }
  return (data ?? []) as TenantListItem[];
}

/** Active tenants with usable credentials — for jobs that fan out across tenants. */
export async function getActiveTenants(): Promise<Tenant[]> {
  const { data, error } = await getMasterClient()
    .from('tenants')
    .select('*')
    .eq('status', 'active');

  if (error) {
    console.error('[master] getActiveTenants failed:', error);
    throw error;
  }
  return Promise.all((data ?? []).map(hydrate));
}

// ─── writes ──────────────────────────────────────────────────────────────────

export async function createTenant(input: CreateTenantInput): Promise<Tenant> {
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(input.subdomain)) {
    throw new Error('הסאב-דומיין יכול להכיל אותיות קטנות, ספרות ומקפים בלבד');
  }

  const existing = await getTenantBySubdomain(input.subdomain);
  if (existing) {
    throw new Error(`הסאב-דומיין "${input.subdomain}" כבר בשימוש`);
  }

  const plan = input.plan_type ?? 'standard';
  const limits = PLAN_LIMITS[plan];

  const [anonKey, serviceKey] = await Promise.all([
    encryptSecret(input.supabase_anon_key, secretAad(input.subdomain, 'anon')),
    input.supabase_service_role_key
      ? encryptSecret(input.supabase_service_role_key, secretAad(input.subdomain, 'service'))
      : Promise.resolve(''),
  ]);

  const { data, error } = await getMasterClient()
    .from('tenants')
    .insert({
      subdomain: input.subdomain,
      name: input.name,
      name_he: input.name_he ?? null,
      status: 'active',
      supabase_project_ref: input.supabase_project_ref,
      supabase_url: input.supabase_url,
      supabase_anon_key: anonKey,
      supabase_service_role_key: serviceKey,
      secrets_key_version: CURRENT_KEY_VERSION,
      plan_type: plan,
      max_users: input.max_users ?? limits.max_users,
      storage_limit_gb: input.storage_limit_gb ?? limits.storage_limit_gb,
      settings: input.settings ?? {},
      setup_status: null,
    })
    .select()
    .single();

  if (error) {
    console.error('[master] createTenant failed:', error);
    throw error;
  }
  return hydrate(data);
}

export async function updateTenant(id: string, input: UpdateTenantInput): Promise<Tenant> {
  const client = getMasterClient();

  // The AAD is bound to the subdomain, so re-sealing a key needs to know it.
  const current = await getTenantRowRaw(id);
  if (!current) throw new Error('הטננט לא נמצא');

  const patch: TenantUpdate = {};

  if (input.name !== undefined) patch.name = input.name;
  if (input.name_he !== undefined) patch.name_he = input.name_he;
  if (input.status !== undefined) patch.status = input.status;
  if (input.plan_type !== undefined) patch.plan_type = input.plan_type;
  if (input.max_users !== undefined) patch.max_users = input.max_users;
  if (input.storage_limit_gb !== undefined) patch.storage_limit_gb = input.storage_limit_gb;
  if (input.settings !== undefined) patch.settings = input.settings;
  if (input.setup_status !== undefined) patch.setup_status = input.setup_status;
  if (input.supabase_url !== undefined) patch.supabase_url = input.supabase_url;

  // Keys arrive as plaintext and are always stored sealed.
  if (input.supabase_anon_key !== undefined) {
    patch.supabase_anon_key = await encryptSecret(
      input.supabase_anon_key,
      secretAad(current.subdomain, 'anon')
    );
    patch.secrets_key_version = CURRENT_KEY_VERSION;
  }
  if (input.supabase_service_role_key !== undefined) {
    patch.supabase_service_role_key = input.supabase_service_role_key
      ? await encryptSecret(
          input.supabase_service_role_key,
          secretAad(current.subdomain, 'service')
        )
      : '';
    patch.secrets_key_version = CURRENT_KEY_VERSION;
  }

  const { data, error } = await client
    .from('tenants')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[master] updateTenant failed:', error);
    throw error;
  }
  return hydrate(data);
}

/** Soft delete — the row is preserved for auditing. */
export async function deleteTenant(id: string): Promise<void> {
  const { error } = await getMasterClient()
    .from('tenants')
    .update({ status: 'deleted' })
    .eq('id', id);

  if (error) {
    console.error('[master] deleteTenant failed:', error);
    throw error;
  }
}

export function suspendTenant(id: string): Promise<Tenant> {
  return updateTenant(id, { status: 'suspended' });
}

export function reactivateTenant(id: string): Promise<Tenant> {
  return updateTenant(id, { status: 'active' });
}

export async function checkMasterConnection(): Promise<boolean> {
  try {
    const { error } = await getMasterClient().from('tenants').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}
