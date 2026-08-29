'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';
import type { Shift7ConfigCategory, SystemConfigRow } from '@/types/database.types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'הפעולה נכשלה');
  return json as T;
}

export function useShift7SystemConfig() {
  return useQuery({
    queryKey: queryKeys.shift7SystemConfig.list(),
    queryFn: () => request<{ systemConfig: SystemConfigRow[] }>('/api/shift7/system-config'),
    select: (data) => data.systemConfig,
  });
}

export interface UpsertConfigInput {
  key: string;
  value: string;
  description?: string | null;
  category: Shift7ConfigCategory;
}

export function useUpsertShift7SystemConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertConfigInput) =>
      request<{ config: SystemConfigRow }>('/api/shift7/system-config', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shift7SystemConfig.all }),
  });
}
