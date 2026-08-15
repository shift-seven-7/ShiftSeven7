-- Initial schema for GuardSync (Base44 -> Supabase migration)
-- See docs/MIGRATION_PLAN.md sections B.2-B.3 for the full design rationale.

-- ============================================================================
-- Enum backing staff.access_level, also the type of the JWT custom claim.
-- ============================================================================
create type public.app_role as enum ('admin', 'scheduler', 'employee', 'no_access');

-- ============================================================================
-- Tables
-- ============================================================================

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  address text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id), -- nullable: login identity, if any
  full_name text not null,
  employee_id text not null unique,
  role text not null check (role in ('guard', 'dispatcher')),
  qualification text not null default 'none'
    check (qualification in ('none', 'shift_supervisor', 'lead_dispatcher')),
  primary_facility uuid not null references public.facilities(id),
  phone text,
  email text,
  status text not null default 'active' check (status in ('active', 'on_leave', 'inactive')),
  access_level public.app_role not null default 'employee',
  weapon_license_expiry date,
  weapon_refresh_expiry date,
  medical_check_expiry date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index ix_staff_primary_facility on public.staff (primary_facility);
create index ix_staff_status on public.staff (status);
create index ix_staff_user_id on public.staff (user_id);

create table public.staff_credential_notification_state (
  staff_id uuid not null references public.staff(id) on delete cascade,
  credential_key text not null check (
    credential_key in ('weapon_license_expiry', 'weapon_refresh_expiry', 'medical_check_expiry')
  ),
  state text not null default 'none' check (state in ('none', 'urgent', 'expired')),
  updated_at timestamptz not null default now(),
  primary key (staff_id, credential_key)
);
-- Replaces Base44's Staff.expiry_notified packed string; only ever touched
-- server-side (service-role key, bypasses RLS) by the credential-expiry cron route.

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  type text not null check (type in ('static', 'control_room')),
  facility uuid not null references public.facilities(id),
  required_role text not null check (required_role in ('guard', 'dispatcher')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (facility, code)
);

create table public.shift_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  category text not null check (category in ('morning', 'afternoon', 'night')),
  start_time time not null,
  end_time time not null,
  duration_hours numeric(4, 2) not null,
  post_number integer,
  color text,
  applicable_roles text[] not null,
  facility uuid references public.facilities(id), -- null = global template
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id),
  staff_name text not null,
  shift_template_id uuid not null references public.shift_templates(id),
  shift_code text not null,
  post_id uuid not null references public.posts(id),
  post_name text,
  facility_id uuid not null references public.facilities(id),
  date date not null,
  actual_start timestamptz not null,
  actual_end timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
  is_published boolean not null default false,
  is_emergency_override boolean not null default false,
  override_reason text,
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index ix_shift_assignments_date on public.shift_assignments (date);
create index ix_shift_assignments_facility_date on public.shift_assignments (facility_id, date);
create index ix_shift_assignments_staff_date on public.shift_assignments (staff_id, date);

create table public.shift_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id),
  staff_name text not null,
  facility_id uuid not null references public.facilities(id),
  week_start date not null,
  date date not null,
  shift_template_id uuid not null references public.shift_templates(id),
  shift_code text not null,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index ix_shift_requests_staff_week on public.shift_requests (staff_id, week_start);
create index ix_shift_requests_week_status on public.shift_requests (week_start, status);

create table public.employee_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id),
  staff_name text not null,
  type text not null check (
    type in ('vacation', 'sick_leave', 'reserve_duty', 'weapon_license', 'health', 'other')
  ),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  start_date date,
  end_date date,
  file_url text,
  file_name text,
  notes text,
  manager_comment text,
  handled_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index ix_employee_requests_staff_created on public.employee_requests (staff_id, created_at desc);
create index ix_employee_requests_created on public.employee_requests (created_at desc);

create table public.staffing_requirements (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id), -- normalized from Base44's facility_code
  day_group text not null check (day_group in ('weekday', 'friday', 'saturday')),
  category text not null check (category in ('morning', 'afternoon', 'night')),
  supervisor integer not null default 0,
  guard integer not null default 0,
  dispatcher integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (facility_id, day_group, category)
);

create table public.system_config (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text not null,
  description text,
  category text not null check (category in ('shift_limits', 'staffing_rules', 'emergency')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

-- ============================================================================
-- Storage: one bucket for EmployeeRequest attachments (replaces Base44's
-- integrations.Core.UploadFile). Files are keyed {user_id}/{filename}.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('employee-request-attachments', 'employee-request-attachments', false);

-- ============================================================================
-- Role-based access control: custom JWT claim via Auth Hook
-- ============================================================================
-- Auth Hook: "Customize Access Token". After this migration runs, this
-- function must also be registered in the Supabase dashboard under
-- Authentication > Hooks - that step is manual and cannot be scripted here.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  role_for_user public.app_role;
begin
  select access_level into role_for_user
  from public.staff
  where user_id = (event ->> 'user_id')::uuid;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  claims := jsonb_set(
    claims,
    '{user_role}',
    to_jsonb(coalesce(role_for_user, 'no_access'::public.app_role))
  );

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.facilities enable row level security;
alter table public.staff enable row level security;
alter table public.staff_credential_notification_state enable row level security;
alter table public.posts enable row level security;
alter table public.shift_templates enable row level security;
alter table public.shift_assignments enable row level security;
alter table public.shift_requests enable row level security;
alter table public.employee_requests enable row level security;
alter table public.staffing_requirements enable row level security;
alter table public.system_config enable row level security;

-- Reference data: readable by anyone with a role, writable by admins only.
create policy "read reference data" on public.facilities
  for select using ((auth.jwt() ->> 'user_role') <> 'no_access');
create policy "admins write facilities" on public.facilities
  for all using ((auth.jwt() ->> 'user_role') = 'admin')
  with check ((auth.jwt() ->> 'user_role') = 'admin');

create policy "read reference data" on public.posts
  for select using ((auth.jwt() ->> 'user_role') <> 'no_access');
create policy "admins write posts" on public.posts
  for all using ((auth.jwt() ->> 'user_role') = 'admin')
  with check ((auth.jwt() ->> 'user_role') = 'admin');

create policy "read reference data" on public.shift_templates
  for select using ((auth.jwt() ->> 'user_role') <> 'no_access');
create policy "admins write shift_templates" on public.shift_templates
  for all using ((auth.jwt() ->> 'user_role') = 'admin')
  with check ((auth.jwt() ->> 'user_role') = 'admin');

create policy "read reference data" on public.staffing_requirements
  for select using ((auth.jwt() ->> 'user_role') <> 'no_access');
create policy "admins write staffing_requirements" on public.staffing_requirements
  for all using ((auth.jwt() ->> 'user_role') = 'admin')
  with check ((auth.jwt() ->> 'user_role') = 'admin');

create policy "read reference data" on public.system_config
  for select using ((auth.jwt() ->> 'user_role') <> 'no_access');
create policy "admins write system_config" on public.system_config
  for all using ((auth.jwt() ->> 'user_role') = 'admin')
  with check ((auth.jwt() ->> 'user_role') = 'admin');

-- staff: admin/scheduler see everyone; anyone else sees only their own row.
create policy "admins and schedulers read all staff" on public.staff
  for select using ((auth.jwt() ->> 'user_role') in ('admin', 'scheduler'));
create policy "staff read own row" on public.staff
  for select using (user_id = auth.uid());
create policy "admins write staff" on public.staff
  for all using ((auth.jwt() ->> 'user_role') = 'admin')
  with check ((auth.jwt() ->> 'user_role') = 'admin');

-- shift_assignments: admin/scheduler see and manage everything; employees see
-- only their own published shifts (mirrors ROUTE_ACCESS's published-schedule-
-- only visibility for employees).
create policy "admins and schedulers read all assignments" on public.shift_assignments
  for select using ((auth.jwt() ->> 'user_role') in ('admin', 'scheduler'));
create policy "staff read own published assignments" on public.shift_assignments
  for select using (
    is_published = true
    and staff_id in (select id from public.staff where user_id = auth.uid())
  );
create policy "admins and schedulers write assignments" on public.shift_assignments
  for all using ((auth.jwt() ->> 'user_role') in ('admin', 'scheduler'))
  with check ((auth.jwt() ->> 'user_role') in ('admin', 'scheduler'));

-- shift_requests: any staff member manages their own; admin/scheduler review all.
create policy "staff manage own shift_requests" on public.shift_requests
  for all using (staff_id in (select id from public.staff where user_id = auth.uid()))
  with check (staff_id in (select id from public.staff where user_id = auth.uid()));
create policy "admins and schedulers read all shift_requests" on public.shift_requests
  for select using ((auth.jwt() ->> 'user_role') in ('admin', 'scheduler'));
create policy "admins and schedulers update shift_requests" on public.shift_requests
  for update using ((auth.jwt() ->> 'user_role') in ('admin', 'scheduler'));

-- employee_requests: any staff member manages their own; admin/scheduler review all.
create policy "staff manage own employee_requests" on public.employee_requests
  for all using (staff_id in (select id from public.staff where user_id = auth.uid()))
  with check (staff_id in (select id from public.staff where user_id = auth.uid()));
create policy "admins and schedulers read all employee_requests" on public.employee_requests
  for select using ((auth.jwt() ->> 'user_role') in ('admin', 'scheduler'));
create policy "admins and schedulers update employee_requests" on public.employee_requests
  for update using ((auth.jwt() ->> 'user_role') in ('admin', 'scheduler'));

-- staff_credential_notification_state: default-deny for all client roles.
-- Only the cron Route Handler (service-role key, bypasses RLS) touches this.

-- Storage: users upload only into their own folder; read own files, or any
-- file if admin/scheduler (matches employee_requests review access above).
create policy "users upload own attachments" on storage.objects
  for insert
  with check (
    bucket_id = 'employee-request-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "own or admin/scheduler read attachments" on storage.objects
  for select using (
    bucket_id = 'employee-request-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (auth.jwt() ->> 'user_role') in ('admin', 'scheduler')
    )
  );
