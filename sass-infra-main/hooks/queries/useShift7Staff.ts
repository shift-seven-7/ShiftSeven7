'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';
import type { StaffRow } from '@/types/database.types';

/** Staff roster data access. Every call goes through /api/* — see the `tanstack-query` skill. */

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });

  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'הפעולה נכשלה');
  return json as T;
}

/** A roster row, with its additional facilities beyond primary_facility. */
export type StaffWithFacilities = StaffRow & { facility_ids: string[] };

export function useShift7Staff(search?: string) {
  return useQuery({
    queryKey: queryKeys.shift7Staff.list(search),
    queryFn: () =>
      request<{ staff: StaffWithFacilities[] }>(
        `/api/shift7/staff${search ? `?search=${encodeURIComponent(search)}` : ''}`
      ),
    select: (data) => data.staff,
  });
}

export type CreateStaffInput = Pick<StaffRow, 'full_name' | 'role' | 'primary_facility'> &
  Partial<Omit<StaffRow, 'id' | 'created_at' | 'updated_at' | 'created_by'>>;

export function useCreateShift7Staff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStaffInput) =>
      request<{ staffMember: StaffRow }>('/api/shift7/staff', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shift7Staff.lists() });
    },
  });
}

export type UpdateStaffInput = Partial<
  Omit<StaffRow, 'id' | 'employee_id' | 'created_at' | 'updated_at' | 'created_by'>
>;

export function useUpdateShift7Staff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateStaffInput & { id: string }) =>
      request<{ staffMember: StaffRow }>(`/api/shift7/staff/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shift7Staff.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.shift7Staff.detail(variables.id) });
    },
  });
}

export function useCreateShift7StaffLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      request<{ staffMember: StaffRow }>(`/api/shift7/staff/${id}/create-login`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shift7Staff.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.shift7Staff.detail(variables.id) });
    },
  });
}

export function useStaffFacilities(staffId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.shift7Staff.all, 'facilities', staffId ?? ''] as const,
    queryFn: () =>
      request<{ facilityIds: string[] }>(`/api/shift7/staff/${staffId}/facilities`),
    select: (data) => data.facilityIds,
    enabled: !!staffId,
  });
}

export function useSetShift7StaffFacilities() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      facilityIds,
      primaryFacility,
    }: {
      id: string;
      facilityIds: string[];
      primaryFacility: string;
    }) =>
      request<{ facilityIds: string[]; primaryFacility: string }>(
        `/api/shift7/staff/${id}/facilities`,
        { method: 'PUT', body: JSON.stringify({ facilityIds, primaryFacility }) }
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shift7Staff.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.shift7Staff.detail(variables.id) });
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.shift7Staff.all, 'facilities', variables.id] as const,
      });
    },
  });
}

export function useDeleteShift7Staff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      request<{ success: true }>(`/api/shift7/staff/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shift7Staff.lists() });
    },
  });
}
