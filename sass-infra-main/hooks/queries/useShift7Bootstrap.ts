'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';
import type { StaffRow } from '@/types/database.types';

/** First-run onboarding — see app/api/shift7/bootstrap/route.ts. */

export interface BootstrapStatus {
  hasStaffRow: boolean;
  canBootstrap: boolean;
  hasAnyFacility: boolean;
}

async function fetchStatus(): Promise<BootstrapStatus> {
  const response = await fetch('/api/shift7/bootstrap');
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'בדיקת סטטוס ההצטרפות נכשלה');
  return json;
}

export function useShift7BootstrapStatus() {
  return useQuery({
    queryKey: [...queryKeys.shift7Staff.all, 'bootstrap-status'] as const,
    queryFn: fetchStatus,
  });
}

export interface BootstrapInput {
  full_name: string;
  role: 'guard' | 'dispatcher';
  primary_facility?: string;
  new_facility_name?: string;
  new_facility_code?: string;
}

export function useShift7Bootstrap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BootstrapInput) => {
      const response = await fetch('/api/shift7/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'ההצטרפות נכשלה');
      return json as { staffMember: StaffRow };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shift7Staff.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.shift7Facilities.all });
    },
  });
}
