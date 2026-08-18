'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';
import type { SetupStatusResponse } from '@/app/api/admin/tenants/[id]/setup/route';
import type { AutomationResult } from '@/lib/services/tenant-automation';
import type { TenantSetupStep, TenantPlan } from '@/types/tenant.types';

export function useTenantSetup(tenantId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tenants.setup(tenantId ?? ''),
    queryFn: async (): Promise<SetupStatusResponse> => {
      const response = await fetch(`/api/admin/tenants/${tenantId}/setup`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'טעינת סטטוס ההקמה נכשלה');
      return json;
    },
    enabled: !!tenantId,
  });
}

export function useRunSetupStep(tenantId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { step: TenantSetupStep; adminEmail?: string }) => {
      const response = await fetch(`/api/admin/tenants/${tenantId}/setup/run-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'הרצת השלב נכשלה');
      return json as { ok: boolean; message: string };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.setup(tenantId ?? '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.detail(tenantId ?? '') });
    },
  });
}

export interface ProvisionTenantInput {
  subdomain: string;
  name: string;
  region?: string;
  plan_type?: TenantPlan;
  adminEmail?: string;
  existingProjectRef?: string;
}

export function useProvisionTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ProvisionTenantInput): Promise<AutomationResult> => {
      const response = await fetch('/api/admin/tenants/create-automated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const json = await response.json();
      // 207 means "partially provisioned" — a real result, not an error.
      if (!response.ok && response.status !== 207) {
        throw new Error(json.error || 'הקמת הטננט נכשלה');
      }
      return json as AutomationResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.lists() });
    },
  });
}
