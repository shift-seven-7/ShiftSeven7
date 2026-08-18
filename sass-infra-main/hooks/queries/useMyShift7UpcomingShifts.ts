'use client';

import { useQuery } from '@tanstack/react-query';
import type { ShiftAssignmentRow } from '@/types/database.types';

async function fetchMine(): Promise<ShiftAssignmentRow[]> {
  const response = await fetch('/api/shift7/shift-assignments/mine');
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'טעינת המשמרות נכשלה');
  return json.shiftAssignments;
}

export function useMyShift7UpcomingShifts() {
  return useQuery({
    queryKey: ['shift7', 'shift-assignments', 'mine'] as const,
    queryFn: fetchMine,
  });
}
