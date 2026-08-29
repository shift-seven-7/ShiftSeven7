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
 * user_id rather than assuming the first row.
 *
 * Shares its cache with useShift7Staff (same query key, deliberately, so
 * pages using both don't double-fetch) - which means the raw queryFn result
 * MUST match useShift7Staff's exactly ({ staff: StaffRow[] }, not an
 * already-unwrapped array). React Query only runs one queryFn per key across
 * simultaneously-mounted observers; whichever shape that one returns becomes
 * every other observer's raw cache entry too. The "find mine" step belongs in
 * `select`, which runs per-observer, not in the fetcher.
 */
async function fetchStaff(): Promise<{ staff: StaffRow[] }> {
  const response = await fetch('/api/shift7/staff');
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'טעינת נתוני העובד נכשלה');
  return json;
}

export function useMyShift7Staff() {
  const { user } = usePermissions();

  return useQuery({
    queryKey: queryKeys.shift7Staff.list(),
    queryFn: fetchStaff,
    select: (data) => data.staff.find((s) => s.user_id === user?.id) ?? null,
  });
}
