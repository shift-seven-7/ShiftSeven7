/**
 * Tenant registry types — mirrors the `tenants` table in the MASTER database.
 * See master_migrations/20260101000000_master_baseline.sql.
 */

export type TenantStatus = 'active' | 'suspended' | 'pending' | 'deleted';

export type TenantPlan = 'trial' | 'standard' | 'premium' | 'enterprise';

/** Per-tenant customisation, stored in `tenants.settings` (JSONB). */
export interface TenantSettings {
  /** Public URL of the tenant's logo, shown in the sidebar. */
  logo_url?: string;
  /** Reserved for a future per-tenant brand color. */
  primary_color?: string;
  /** Vanity domain, if the tenant is not served from a subdomain. */
  custom_domain?: string;

  /**
   * Enabled module keys. `undefined` means "everything in the registry".
   * See lib/constants/features.ts.
   */
  features?: string[];

  /** Legal copy shown in the acceptance dialog. */
  terms_of_service?: string;
  privacy_policy?: string;
  /** ISO date, re-stamped whenever the legal copy is saved. */
  terms_version?: string;
}

/** The eight provisioning steps, in execution order. */
export const TENANT_SETUP_STEPS = [
  'project_created',
  'migrations_applied',
  'buckets_created',
  'auth_configured',
  'credentials_saved',
  'tenant_registered',
  'domain_added',
  'admin_created',
] as const;

export type TenantSetupStep = (typeof TENANT_SETUP_STEPS)[number];

export interface TenantSetupStatus {
  steps: Partial<Record<TenantSetupStep, boolean>>;
  admin_email?: string;
  last_error?: string;
  updated_at?: string;
}

/**
 * A fully hydrated tenant — the Supabase keys here are PLAINTEXT, decrypted by
 * lib/supabase/master-client.ts.
 *
 * This type must never cross the network boundary to a browser. API responses
 * use `TenantPublic` from lib/tenant/serialize.ts instead.
 */
export interface Tenant {
  id: string;
  subdomain: string;
  name: string;
  name_he: string | null;
  status: TenantStatus;

  supabase_project_ref: string;
  supabase_url: string;
  supabase_anon_key: string;
  supabase_service_role_key: string;
  secrets_key_version: number;

  plan_type: TenantPlan;
  max_users: number;
  storage_limit_gb: number;

  settings: TenantSettings;
  setup_status: TenantSetupStatus | null;

  created_at: string;
  updated_at: string;
}

/**
 * The routing slice: everything needed to reach a tenant's Supabase project,
 * and nothing that an admin can edit.
 *
 * This is the ONLY shape the proxy caches. Mutable configuration (`settings`,
 * plan, limits) is deliberately excluded so a cached entry can never serve
 * stale settings — read those with `getTenantById` when you need them.
 */
export interface TenantConnection {
  id: string;
  subdomain: string;
  status: TenantStatus;
  supabase_url: string;
  supabase_anon_key: string;
}

/** The columns the tenant list screen needs — never includes a key. */
export interface TenantListItem {
  id: string;
  subdomain: string;
  name: string;
  name_he: string | null;
  status: TenantStatus;
  plan_type: TenantPlan;
  max_users: number;
  setup_status: TenantSetupStatus | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTenantInput {
  subdomain: string;
  name: string;
  name_he?: string | null;
  supabase_project_ref: string;
  supabase_url: string;
  supabase_anon_key: string;
  supabase_service_role_key: string;
  plan_type?: TenantPlan;
  max_users?: number;
  storage_limit_gb?: number;
  settings?: TenantSettings;
}

/**
 * `subdomain` is deliberately absent: it is immutable after creation because
 * the encryption AAD is bound to it (see lib/crypto/secrets.ts), and because
 * DNS records and OAuth redirect URLs are keyed to it.
 */
export interface UpdateTenantInput {
  name?: string;
  name_he?: string | null;
  status?: TenantStatus;
  plan_type?: TenantPlan;
  max_users?: number;
  storage_limit_gb?: number;
  settings?: TenantSettings;
  supabase_url?: string;
  supabase_anon_key?: string;
  supabase_service_role_key?: string;
  setup_status?: TenantSetupStatus | null;
}

export const PLAN_LIMITS: Record<TenantPlan, { max_users: number; storage_limit_gb: number }> = {
  trial: { max_users: 5, storage_limit_gb: 1 },
  standard: { max_users: 25, storage_limit_gb: 10 },
  premium: { max_users: 100, storage_limit_gb: 50 },
  enterprise: { max_users: 1000, storage_limit_gb: 500 },
};

export const PLAN_LABELS: Record<TenantPlan, string> = {
  trial: 'ניסיון',
  standard: 'סטנדרט',
  premium: 'פרימיום',
  enterprise: 'ארגוני',
};

export const STATUS_LABELS: Record<TenantStatus, string> = {
  active: 'פעיל',
  suspended: 'מושהה',
  pending: 'ממתין',
  deleted: 'נמחק',
};

export const SETUP_STEP_LABELS: Record<TenantSetupStep, string> = {
  project_created: 'יצירת פרויקט Supabase',
  migrations_applied: 'הרצת מיגרציות',
  buckets_created: 'יצירת אחסון',
  auth_configured: 'הגדרת התחברות',
  credentials_saved: 'שמירת מפתחות',
  tenant_registered: 'רישום במאגר',
  domain_added: 'הוספת דומיין',
  admin_created: 'יצירת מנהל ראשון',
};
