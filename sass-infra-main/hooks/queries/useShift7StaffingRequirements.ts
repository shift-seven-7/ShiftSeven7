'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';
import type { StaffingRequirementRow } from '@/types/database.types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'הפעולה נכשלה');
  return json as T;
}

export function useShift7StaffingRequirements() {
  return useQuery({
    queryKey: queryKeys.shift7StaffingRequirements.list(),
    queryFn: () =>
      request<{ staffingRequirements: StaffingRequirementRow[] }>('/api/shift7/staffing-requirements'),
    select: (data) => data.staffingRequirements,
  });
}

export type UpsertStaffingRequirementInput = Pick<
  StaffingRequirementRow,
  'facility_id' | 'day_group' | 'category' | 'supervisor' | 'guard' | 'dispatcher'
>;

export function useUpsertShift7StaffingRequirement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertStaffingRequirementInput) =>
      request<{ staffingRequirement: StaffingRequirementRow }>('/api/shift7/staffing-requirements', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7StaffingRequirements.all }),
  });
}
