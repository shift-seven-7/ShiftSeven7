'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';
import type { TenantSettingsResponse } from '@/app/api/tenant/settings/route';
import type { TenantSettings } from '@/types/tenant.types';

/**
 * The current tenant's own settings. Read by the shell (for the logo) and
 * written by the client-settings tab.
 */

export function useTenantSettings() {
  return useQuery({
    queryKey: queryKeys.tenantSettings.current(),
    queryFn: async (): Promise<TenantSettingsResponse> => {
      const response = await fetch('/api/tenant/settings');
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'טעינת ההגדרות נכשלה');
      return json;
    },
  });
}

export type UpdateTenantSettingsInput = Partial<TenantSettings> & {
  /** Editing another tenant's settings from the registry console. */
  targetTenantId?: string;
};

export function useUpdateTenantSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateTenantSettingsInput): Promise<TenantSettingsResponse> => {
      const response = await fetch('/api/tenant/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'שמירת ההגדרות נכשלה');
      return json;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantSettings.all });
      // /api/users/me carries the logo and the module set.
      queryClient.invalidateQueries({ queryKey: queryKeys.users.me() });
      if (variables.targetTenantId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.tenants.detail(variables.targetTenantId),
        });
      }
    },
  });
}
