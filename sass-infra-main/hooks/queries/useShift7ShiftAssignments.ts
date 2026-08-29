'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';
import type { ShiftAssignmentRow } from '@/types/database.types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'הפעולה נכשלה');
  return json as T;
}

/** A week (or any date range) of assignments — RLS scopes rows to what the caller may see. */
export function useShift7ShiftAssignments(from: string, to: string, facilityId?: string, staffId?: string) {
  return useQuery({
    queryKey: queryKeys.shift7ShiftAssignments.range(from, to, facilityId, staffId),
    queryFn: () => {
      const params = new URLSearchParams({ from, to });
      if (facilityId) params.set('facilityId', facilityId);
      if (staffId) params.set('staffId', staffId);
      return request<{ shiftAssignments: ShiftAssignmentRow[] }>(
        `/api/shift7/shift-assignments?${params.toString()}`
      );
    },
    select: (data) => data.shiftAssignments,
    enabled: !!from && !!to,
  });
}

export type CreateShiftAssignmentInput = Pick<
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
  Partial<Omit<ShiftAssignmentRow, 'id' | 'created_at' | 'updated_at' | 'created_by'>>;

export function useCreateShift7ShiftAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShiftAssignmentInput) =>
      request<{ shiftAssignment: ShiftAssignmentRow }>('/api/shift7/shift-assignments', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7ShiftAssignments.all }),
  });
}

export type UpdateShiftAssignmentInput = Partial<
  Pick<ShiftAssignmentRow, 'actual_start' | 'actual_end' | 'override_reason' | 'status'>
>;

export function useUpdateShift7ShiftAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateShiftAssignmentInput & { id: string }) =>
      request<{ shiftAssignment: ShiftAssignmentRow }>(`/api/shift7/shift-assignments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7ShiftAssignments.all }),
  });
}

export function useDeleteShift7ShiftAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request<{ success: true }>(`/api/shift7/shift-assignments/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7ShiftAssignments.all }),
  });
}

export interface PublishShift7ScheduleInput {
  ids: string[];
  weekLabel: string;
  facilityName?: string;
  staffNames?: string[];
}

export function usePublishShift7Schedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PublishShift7ScheduleInput) =>
      request<{ published: number }>('/api/shift7/shift-assignments/publish', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7ShiftAssignments.all }),
  });
}
