'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';
import type { ShiftRequestRow } from '@/types/database.types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'הפעולה נכשלה');
  return json as T;
}

export function useShift7ShiftRequests(weekStart: string) {
  return useQuery({
    queryKey: queryKeys.shift7ShiftRequests.mine(weekStart),
    queryFn: () =>
      request<{ shiftRequests: ShiftRequestRow[] }>(
        `/api/shift7/shift-requests?week_start=${encodeURIComponent(weekStart)}`
      ),
    select: (data) => data.shiftRequests,
    enabled: !!weekStart,
  });
}

export interface SelectShiftRequestInput {
  week_start: string;
  date: string;
  shift_template_id: string;
  shift_code: string;
}

export function useSelectShift7Request() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SelectShiftRequestInput) =>
      request<{ shiftRequest: ShiftRequestRow }>('/api/shift7/shift-requests', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7ShiftRequests.all }),
  });
}

export function useDeleteShift7Request() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request<{ success: true }>(`/api/shift7/shift-requests/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7ShiftRequests.all }),
  });
}

export function useSubmitShift7Requests() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (weekStart: string) =>
      request<{ success: true }>('/api/shift7/shift-requests/submit', {
        method: 'POST',
        body: JSON.stringify({ week_start: weekStart }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7ShiftRequests.all }),
  });
}
