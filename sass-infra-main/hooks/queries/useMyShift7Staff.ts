'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './keys';
import { usePermissions } from '@/lib/hooks/usePermissions';
import type { StaffRow } from '@/types/database.types';

/**
 * The signed-in user's own Shift7 staff row, or null if they don't have one.
 *
 * GET /api/shift7/staff returns everything RLS lets the caller see — for a
 * plain employee that's already just their own row ("shift7 staff read own
 * row"); for an admin/scheduler it's everyone, so this filters client-side by
 * user_id rather than assuming the first row. Shares its cache with
 * useShift7Staff (same query key) so pages using both don't double-fetch.
 */
async function fetchStaff(): Promise<StaffRow[]> {
  const response = await fetch('/api/shift7/staff');
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'טעינת נתוני העובד נכשלה');
  return json.staff;
}

export function useMyShift7Staff() {
  const { user } = usePermissions();

  const query = useQuery({
    queryKey: queryKeys.shift7Staff.list(),
    queryFn: fetchStaff,
    enabled: !!user,
  });

  const mine = query.data?.find((s) => s.user_id === user?.id) ?? null;

  return { ...query, data: mine };
}
