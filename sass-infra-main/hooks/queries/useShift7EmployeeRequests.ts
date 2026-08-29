'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';
import type { EmployeeRequestRow, Shift7EmployeeRequestType } from '@/types/database.types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'הפעולה נכשלה');
  return json as T;
}

/** The caller's own requests. */
export function useMyShift7EmployeeRequests() {
  return useQuery({
    queryKey: queryKeys.shift7EmployeeRequests.mine(),
    queryFn: () => request<{ employeeRequests: EmployeeRequestRow[] }>('/api/shift7/employee-requests'),
    select: (data) => data.employeeRequests,
  });
}

/** Every request — admin/scheduler review. Server enforces the role check. */
export function useAllShift7EmployeeRequests(enabled = true) {
  return useQuery({
    queryKey: queryKeys.shift7EmployeeRequests.list('all'),
    queryFn: () =>
      request<{ employeeRequests: EmployeeRequestRow[] }>('/api/shift7/employee-requests?scope=all'),
    select: (data) => data.employeeRequests,
    refetchInterval: 30_000,
    // Only admin/scheduler may call ?scope=all — callers that don't yet know
    // the current Shift7 role (or know it's 'employee') should pass false,
    // otherwise this fires and 403s on every mount.
    enabled,
  });
}

export interface CreateEmployeeRequestInput {
  type: Shift7EmployeeRequestType;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
}

export function useCreateShift7EmployeeRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEmployeeRequestInput) =>
      request<{ employeeRequest: EmployeeRequestRow }>('/api/shift7/employee-requests', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7EmployeeRequests.all }),
  });
}

export function useDecideShift7EmployeeRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      managerComment,
    }: {
      id: string;
      status: 'approved' | 'rejected';
      managerComment?: string;
    }) =>
      request<{ employeeRequest: EmployeeRequestRow; cancelledAssignments: number }>(
        `/api/shift7/employee-requests/${id}`,
        { method: 'PATCH', body: JSON.stringify({ status, manager_comment: managerComment || null }) }
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7EmployeeRequests.all }),
  });
}

export function useDeleteShift7EmployeeRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request<{ success: true }>(`/api/shift7/employee-requests/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7EmployeeRequests.all }),
  });
}
