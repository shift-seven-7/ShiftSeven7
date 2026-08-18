/**
 * Typed schema for the MASTER Supabase project.
 *
 * Hand-written rather than generated: the master registry is one table plus a
 * migration-tracking table, and typing it is what gives the encryption layer a
 * compiler safety net (an untyped master client needs a `@ts-expect-error` on
 * every write).
 *
 * NOTE: the row shapes below are `type` aliases, not `interface`s, and that is
 * load-bearing. Supabase's `GenericTable` constrains `Row` to
 * `Record<string, unknown>`; TypeScript grants an implicit index signature to a
 * type alias but never to an interface, so an interface here silently fails the
 * constraint and every query degrades to `never`.
 *
 * Keep in sync with master_migrations/.
 */

import type {
  TenantPlan,
  TenantSettings,
  TenantSetupStatus,
  TenantStatus,
} from './tenant.types';

/** A row exactly as stored — the Supabase keys here are CIPHERTEXT. */
export type TenantRow = {
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
  /**
   * Per-tenant secrets, each VALUE an AES-GCM envelope. Deliberately absent
   * from `Tenant`: nothing may read this bag by spreading a row, only through
   * getTenantSecret/setTenantSecret.
   */
  secrets: Record<string, string>;
  setup_status: TenantSetupStatus | null;
  created_at: string;
  updated_at: string;
};

export type TenantInsert = Omit<
  TenantRow,
  'id' | 'created_at' | 'updated_at' | 'secrets'
> &
  Partial<Pick<TenantRow, 'id' | 'created_at' | 'updated_at' | 'secrets'>>;

export type TenantUpdate = Partial<Omit<TenantRow, 'id'>>;

export type MasterMigrationRow = {
  filename: string;
  applied_at: string;
};

export type MasterDatabase = {
  public: {
    Tables: {
      tenants: {
        Row: TenantRow;
        Insert: TenantInsert;
        Update: TenantUpdate;
        Relationships: [];
      };
      _master_applied_migrations: {
        Row: MasterMigrationRow;
        Insert: { filename: string; applied_at?: string };
        Update: Partial<MasterMigrationRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
