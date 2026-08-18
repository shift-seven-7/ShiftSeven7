'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';
import type { FacilityRow } from '@/types/database.types';

/**
 * Facility create/edit/delete — kept separate from useShift7Facilities.ts
 * (read-only, used by the staff form) so that file stays untouched.
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

export type CreateFacilityInput = Pick<FacilityRow, 'name' | 'code'> &
  Partial<Omit<FacilityRow, 'id' | 'created_at' | 'updated_at' | 'created_by'>>;
export type UpdateFacilityInput = Partial<Omit<FacilityRow, 'id' | 'created_at' | 'updated_at' | 'created_by'>>;

export function useCreateShift7Facility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFacilityInput) =>
      request<{ facility: FacilityRow }>('/api/shift7/facilities', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7Facilities.all }),
  });
}

export function useUpdateShift7Facility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateFacilityInput & { id: string }) =>
      request<{ facility: FacilityRow }>(`/api/shift7/facilities/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7Facilities.all }),
  });
}

export function useDeleteShift7Facility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request<{ success: true }>(`/api/shift7/facilities/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7Facilities.all }),
  });
}
