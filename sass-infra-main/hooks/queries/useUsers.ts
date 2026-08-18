'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, type UserFilters } from './keys';
import type { UsersResponse } from '@/app/api/users/route';
import type { UserRow } from '@/types/database.types';
import type { UserRole } from '@/types/roles';

/**
 * Users data access. Every call goes through /api/* — the client never touches
 * Supabase directly. See the `tanstack-query` skill.
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

function buildQuery(filters?: UserFilters): string {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.role) params.set('role', filters.role);
  if (filters?.isActive !== undefined) params.set('isActive', String(filters.isActive));
  if (filters?.page !== undefined) params.set('page', String(filters.page));
  if (filters?.pageSize !== undefined) params.set('pageSize', String(filters.pageSize));

  const query = params.toString();
  return query ? `?${query}` : '';
}

export function useUsers(filters?: UserFilters) {
  return useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: () => request<UsersResponse>(`/api/users${buildQuery(filters)}`),
  });
}

export interface InviteUserInput {
  /** Whichever the deployment's sign-in methods can reach — see getInviteChannels(). */
  email?: string;
  phone?: string;
  fullName?: string;
  role: UserRole;
}

export function useInviteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: InviteUserInput) =>
      request<{ user: UserRow }>('/api/users/invite', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
    },
  });
}

export type UpdateUserInput = Partial<
  Pick<UserRow, 'full_name' | 'phone' | 'app_role' | 'is_active' | 'features_override'>
>;

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateUserInput & { id: string }) =>
      request<{ user: UserRow }>(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(variables.id) });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      request<{ success: true }>(`/api/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
    },
  });
}
