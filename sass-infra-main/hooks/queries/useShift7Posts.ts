'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';
import type { PostRow } from '@/types/database.types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'הפעולה נכשלה');
  return json as T;
}

export function useShift7Posts() {
  return useQuery({
    queryKey: queryKeys.shift7Posts.list(),
    queryFn: () => request<{ posts: PostRow[] }>('/api/shift7/posts'),
    select: (data) => data.posts,
  });
}

export type CreatePostInput = Pick<PostRow, 'name' | 'code' | 'type' | 'facility' | 'required_role'> &
  Partial<Omit<PostRow, 'id' | 'created_at' | 'updated_at' | 'created_by'>>;
export type UpdatePostInput = Partial<Omit<PostRow, 'id' | 'created_at' | 'updated_at' | 'created_by'>>;

export function useCreateShift7Post() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput) =>
      request<{ post: PostRow }>('/api/shift7/posts', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7Posts.all }),
  });
}

export function useUpdateShift7Post() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: UpdatePostInput & { id: string }) =>
      request<{ post: PostRow }>(`/api/shift7/posts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7Posts.all }),
  });
}

export function useDeleteShift7Post() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<{ success: true }>(`/api/shift7/posts/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7Posts.all }),
  });
}
