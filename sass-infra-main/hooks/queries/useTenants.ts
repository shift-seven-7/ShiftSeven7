'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';
import type { TenantsListResponse } from '@/app/api/admin/tenants/route';
import type { TenantPublic } from '@/lib/tenant/serialize';
import type { TenantSettings, TenantPlan } from '@/types/tenant.types';

/**
 * Tenant registry access.
 *
 * Note the types: the client only ever sees `TenantPublic`, which has no
 * Supabase keys on it.
 */

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });

  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'הפעולה נכשלה');
  return json as T;
}

export function useTenants() {
  return useQuery({
    queryKey: queryKeys.tenants.list(),
    queryFn: () => request<TenantsListResponse>('/api/admin/tenants'),
  });
}

export function useTenant(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tenants.detail(id ?? ''),
    queryFn: () => request<{ tenant: TenantPublic }>(`/api/admin/tenants/${id}`),
    enabled: !!id,
  });
}

export interface CreateTenantBody {
  subdomain: string;
  name: string;
  name_he?: string;
  supabase_project_ref: string;
  supabase_url: string;
  supabase_anon_key: string;
  supabase_service_role_key?: string;
  plan_type?: TenantPlan;
}

export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateTenantBody) =>
      request<{ tenant: TenantPublic }>('/api/admin/tenants', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.lists() });
    },
  });
}

export interface UpdateTenantBody {
  action?: 'suspend' | 'reactivate';
  name?: string;
  name_he?: string | null;
  plan_type?: TenantPlan;
  max_users?: number;
  storage_limit_gb?: number;
  settings?: TenantSettings;
  supabase_url?: string;
  /** Write-only: omit or send empty to keep the stored key. */
  supabase_anon_key?: string;
  supabase_service_role_key?: string;
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...body }: UpdateTenantBody & { id: string }) =>
      request<{ tenant: TenantPublic }>(`/api/admin/tenants/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.detail(variables.id) });
    },
  });
}

export function useDeleteTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      request<{ success: true }>(`/api/admin/tenants/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.lists() });
    },
  });
}
