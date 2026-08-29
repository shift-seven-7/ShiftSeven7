/**
 * Schema of a TENANT database.
 *
 * Hand-written to match supabase/migrations/20260101000000_baseline.sql. Once a
 * project adds module tables, switch to the generated file:
 *
 *     npx supabase gen types typescript --local > types/database.types.ts
 *
 * …and keep `UserRole` imported from types/roles.ts rather than inlined, so the
 * role list has exactly one definition.
 *
 * NOTE: the row shapes are `type` aliases, not `interface`s, and that is
 * load-bearing — Supabase constrains `Row` to `Record<string, unknown>`, and
 * TypeScript grants an implicit index signature to a type alias but never to an
 * interface. An interface here makes every query resolve to `never`.
 */

import type { UserRole } from './roles';

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type UserRow = {
  id: string;
  /**
   * Nullable: a phone-OTP deployment creates accounts that never had an email
   * address. The DB enforces `email IS NOT NULL OR phone IS NOT NULL`.
   */
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  /** null = signed up, awaiting an admin's approval. */
  app_role: UserRole | null;
  is_active: boolean;
  /** Created by an admin; cannot sign in on their own. */
  is_managed: boolean;
  invited_at: string | null;
  /** Per-user module overrides: { [featureKey]: boolean }. */
  features_override: Record<string, boolean>;
  theme_mode: string | null;
  theme_color: string | null;
  created_at: string;
  updated_at: string;
};

export type SystemSettingRow = {
  key: string;
  value: Json;
  updated_at: string;
  updated_by: string | null;
};

export type TenantFeatureDefaultRow = {
  feature_key: string;
  enabled: boolean;
  updated_at: string;
};

export type FileRow = {
  id: string;
  name: string;
  original_name: string;
  mime_type: string;
  size: number;
  bucket: string;
  path: string;
  url: string;
  user_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  width: number | null;
  height: number | null;
  is_public: boolean;
  created_at: string;
};

export type TermsAcceptanceRow = {
  user_id: string;
  version: string;
  accepted_at: string;
};

// ─── Shift7 module ────────────────────────────────────────────────────────
//
// Hand-written to match supabase/migrations/20260104000000_shift7_baseline.sql.
// Only the tables the ported pages need so far are listed here (facilities,
// staff) — the remaining Shift7 tables get added as their own pages are
// ported, same as this file's header note for the baseline.

export type Shift7StaffRole = 'guard' | 'dispatcher';
export type Shift7Qualification = 'none' | 'shift_supervisor' | 'lead_dispatcher';
export type Shift7StaffStatus = 'active' | 'on_leave' | 'inactive';
/** Module-internal role, read by public.current_shift7_role() — not a platform UserRole. */
export type Shift7AccessLevel = 'admin' | 'scheduler' | 'employee' | 'no_access';
export type Shift7FacilityStatus = 'active' | 'inactive';

export type FacilityRow = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  status: Shift7FacilityStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type StaffRow = {
  id: string;
  /** Nullable: a login identity, if this staff member has one. */
  user_id: string | null;
  full_name: string;
  employee_id: string;
  role: Shift7StaffRole;
  qualification: Shift7Qualification;
  primary_facility: string;
  phone: string | null;
  email: string | null;
  status: Shift7StaffStatus;
  access_level: Shift7AccessLevel;
  weapon_license_expiry: string | null;
  weapon_refresh_expiry: string | null;
  medical_check_expiry: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type Shift7CredentialKey =
  | 'weapon_license_expiry'
  | 'weapon_refresh_expiry'
  | 'medical_check_expiry';
export type Shift7CredentialNotificationState = 'none' | 'urgent' | 'expired';

/**
 * Only ever touched server-side by the credential-expiry cron route (service
 * role, bypasses RLS) — see app/api/shift7/cron/check-credential-expiries.
 * No page reads or writes this table directly.
 */
export type StaffCredentialNotificationStateRow = {
  staff_id: string;
  credential_key: Shift7CredentialKey;
  state: Shift7CredentialNotificationState;
  updated_at: string;
};

export type Shift7PostType = 'static' | 'control_room';

export type PostRow = {
  id: string;
  name: string;
  code: string;
  type: Shift7PostType;
  facility: string;
  required_role: Shift7StaffRole;
  status: Shift7FacilityStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type Shift7Category = 'morning' | 'afternoon' | 'night';

export type ShiftTemplateRow = {
  id: string;
  code: string;
  name: string;
  category: Shift7Category;
  /** 'HH:MM:SS', as Postgres TIME comes back over PostgREST. */
  start_time: string;
  end_time: string;
  duration_hours: number;
  post_number: number | null;
  color: string | null;
  applicable_roles: Shift7StaffRole[];
  /** null = global template, not tied to one facility. */
  facility: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type Shift7AssignmentStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type ShiftAssignmentRow = {
  id: string;
  staff_id: string;
  staff_name: string;
  shift_template_id: string;
  shift_code: string;
  post_id: string;
  post_name: string | null;
  facility_id: string;
  date: string;
  actual_start: string;
  actual_end: string;
  status: Shift7AssignmentStatus;
  is_published: boolean;
  is_emergency_override: boolean;
  override_reason: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type Shift7RequestStatus = 'draft' | 'submitted';

export type ShiftRequestRow = {
  id: string;
  staff_id: string;
  staff_name: string;
  facility_id: string;
  week_start: string;
  date: string;
  shift_template_id: string;
  shift_code: string;
  status: Shift7RequestStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type Shift7EmployeeRequestType =
  | 'vacation'
  | 'sick_leave'
  | 'reserve_duty'
  | 'weapon_license'
  | 'health'
  | 'other';
export type Shift7EmployeeRequestStatus = 'pending' | 'approved' | 'rejected';

export type EmployeeRequestRow = {
  id: string;
  staff_id: string;
  staff_name: string;
  type: Shift7EmployeeRequestType;
  status: Shift7EmployeeRequestStatus;
  start_date: string | null;
  end_date: string | null;
  /** Attachment, if any, is indexed in public.files — entity_type='employee_request', entity_id=this row's id. Not a column here. */
  notes: string | null;
  manager_comment: string | null;
  handled_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type Shift7DayGroup = 'weekday' | 'friday' | 'saturday';

export type StaffingRequirementRow = {
  id: string;
  facility_id: string;
  day_group: Shift7DayGroup;
  category: Shift7Category;
  supervisor: number;
  guard: number;
  dispatcher: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type Shift7ConfigCategory = 'shift_limits' | 'staffing_rules' | 'emergency';

export type SystemConfigRow = {
  id: string;
  key: string;
  value: string;
  description: string | null;
  category: Shift7ConfigCategory;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type Database = {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        // Only `id` is structurally required. Which identifier must be present
        // depends on the sign-in method, so that rule lives in the DB's
        // `users_identity_present` check rather than in the type.
        Insert: Pick<UserRow, 'id'> & Partial<UserRow>;
        Update: Partial<UserRow>;
        Relationships: [];
      };
      system_settings: {
        Row: SystemSettingRow;
        Insert: Pick<SystemSettingRow, 'key' | 'value'> & Partial<SystemSettingRow>;
        Update: Partial<SystemSettingRow>;
        Relationships: [];
      };
      tenant_feature_defaults: {
        Row: TenantFeatureDefaultRow;
        Insert: Pick<TenantFeatureDefaultRow, 'feature_key'> &
          Partial<TenantFeatureDefaultRow>;
        Update: Partial<TenantFeatureDefaultRow>;
        Relationships: [];
      };
      files: {
        Row: FileRow;
        // Columns with a database default or a NULL default are optional here;
        // only the ones the caller genuinely has to supply are required.
        Insert: Pick<
          FileRow,
          'name' | 'original_name' | 'mime_type' | 'size' | 'bucket' | 'path' | 'url'
        > &
          Partial<FileRow>;
        Update: Partial<FileRow>;
        Relationships: [];
      };
      terms_acceptances: {
        Row: TermsAcceptanceRow;
        Insert: Pick<TermsAcceptanceRow, 'user_id' | 'version'> &
          Partial<TermsAcceptanceRow>;
        Update: Partial<TermsAcceptanceRow>;
        Relationships: [];
      };
      facilities: {
        Row: FacilityRow;
        Insert: Pick<FacilityRow, 'name' | 'code'> & Partial<FacilityRow>;
        Update: Partial<FacilityRow>;
        Relationships: [];
      };
      staff: {
        Row: StaffRow;
        Insert: Pick<StaffRow, 'full_name' | 'employee_id' | 'role' | 'primary_facility'> &
          Partial<StaffRow>;
        Update: Partial<StaffRow>;
        Relationships: [];
      };
      staff_credential_notification_state: {
        Row: StaffCredentialNotificationStateRow;
        Insert: Pick<StaffCredentialNotificationStateRow, 'staff_id' | 'credential_key'> &
          Partial<StaffCredentialNotificationStateRow>;
        Update: Partial<StaffCredentialNotificationStateRow>;
        Relationships: [];
      };
      posts: {
        Row: PostRow;
        Insert: Pick<PostRow, 'name' | 'code' | 'type' | 'facility' | 'required_role'> &
          Partial<PostRow>;
        Update: Partial<PostRow>;
        Relationships: [];
      };
      shift_templates: {
        Row: ShiftTemplateRow;
        Insert: Pick<
          ShiftTemplateRow,
          'code' | 'name' | 'category' | 'start_time' | 'end_time' | 'duration_hours' | 'applicable_roles'
        > &
          Partial<ShiftTemplateRow>;
        Update: Partial<ShiftTemplateRow>;
        Relationships: [];
      };
      shift_assignments: {
        Row: ShiftAssignmentRow;
        Insert: Pick<
          ShiftAssignmentRow,
          | 'staff_id'
          | 'staff_name'
          | 'shift_template_id'
          | 'shift_code'
          | 'post_id'
          | 'facility_id'
          | 'date'
          | 'actual_start'
          | 'actual_end'
        > &
          Partial<ShiftAssignmentRow>;
        Update: Partial<ShiftAssignmentRow>;
        Relationships: [];
      };
      shift_requests: {
        Row: ShiftRequestRow;
        Insert: Pick<
          ShiftRequestRow,
          'staff_id' | 'staff_name' | 'facility_id' | 'week_start' | 'date' | 'shift_template_id' | 'shift_code'
        > &
          Partial<ShiftRequestRow>;
        Update: Partial<ShiftRequestRow>;
        Relationships: [];
      };
      employee_requests: {
        Row: EmployeeRequestRow;
        Insert: Pick<EmployeeRequestRow, 'staff_id' | 'staff_name' | 'type'> & Partial<EmployeeRequestRow>;
        Update: Partial<EmployeeRequestRow>;
        Relationships: [];
      };
      staffing_requirements: {
        Row: StaffingRequirementRow;
        Insert: Pick<StaffingRequirementRow, 'facility_id' | 'day_group' | 'category'> &
          Partial<StaffingRequirementRow>;
        Update: Partial<StaffingRequirementRow>;
        Relationships: [];
      };
      system_config: {
        Row: SystemConfigRow;
        Insert: Pick<SystemConfigRow, 'key' | 'value' | 'category'> & Partial<SystemConfigRow>;
        Update: Partial<SystemConfigRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      current_app_role: { Args: Record<string, never>; Returns: string | null };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      current_shift7_role: { Args: Record<string, never>; Returns: Shift7AccessLevel | null };
      is_shift7_admin: { Args: Record<string, never>; Returns: boolean };
      is_shift7_scheduler_or_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type { UserRole };
