'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';
import type { ShiftTemplateRow } from '@/types/database.types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'הפעולה נכשלה');
  return json as T;
}

export function useShift7ShiftTemplates() {
  return useQuery({
    queryKey: queryKeys.shift7ShiftTemplates.list(),
    queryFn: () => request<{ shiftTemplates: ShiftTemplateRow[] }>('/api/shift7/shift-templates'),
    select: (data) => data.shiftTemplates,
  });
}

export type CreateShiftTemplateInput = Pick<
  ShiftTemplateRow,
  'code' | 'name' | 'category' | 'start_time' | 'end_time' | 'duration_hours' | 'applicable_roles'
> &
  Partial<Omit<ShiftTemplateRow, 'id' | 'created_at' | 'updated_at' | 'created_by'>>;
export type UpdateShiftTemplateInput = Partial<
  Omit<ShiftTemplateRow, 'id' | 'created_at' | 'updated_at' | 'created_by'>
>;

export function useCreateShift7ShiftTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShiftTemplateInput) =>
      request<{ shiftTemplate: ShiftTemplateRow }>('/api/shift7/shift-templates', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7ShiftTemplates.all }),
  });
}

export function useUpdateShift7ShiftTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateShiftTemplateInput & { id: string }) =>
      request<{ shiftTemplate: ShiftTemplateRow }>(`/api/shift7/shift-templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7ShiftTemplates.all }),
  });
}

export function useDeleteShift7ShiftTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request<{ success: true }>(`/api/shift7/shift-templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7ShiftTemplates.all }),
  });
}
