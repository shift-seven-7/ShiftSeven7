'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './keys';
import type { FacilityRow } from '@/types/database.types';

/** Facility data access. Every call goes through /api/* — see the `tanstack-query` skill. */

async function fetchFacilities(): Promise<FacilityRow[]> {
  const response = await fetch('/api/shift7/facilities');
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'טעינת המתקנים נכשלה');
  return json.facilities;
}

export function useShift7Facilities() {
  return useQuery({
    queryKey: queryKeys.shift7Facilities.list(),
    queryFn: fetchFacilities,
  });
}
