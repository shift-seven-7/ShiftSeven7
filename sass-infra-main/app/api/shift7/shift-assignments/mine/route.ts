import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthInfo, requireApproved, serverError } from '@/lib/api/auth';

/**
 * The caller's own upcoming, published shifts — for my-area. RLS ("shift7
 * staff read own published assignments") already confines this to the
 * caller's own, published rows; this just adds the date-range narrowing.
 *
 * Full shift_assignments CRUD (the schedule/smart-schedule/unstaffed-shifts/
 * published-schedule pages) is out of scope for this pass — see the report.
 */
export async function GET() {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const { data: me } = await supabase
    .from('staff')
    .select('id')
    .eq('user_id', auth!.userId)
    .maybeSingle();
  if (!me) return NextResponse.json({ shiftAssignments: [] });

  const todayStr = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('shift_assignments')
    .select('*')
    .eq('staff_id', me.id)
    .eq('is_published', true)
    .gte('date', todayStr)
    .order('date')
    .limit(10);

  if (error) {
    console.error('[api/shift7/shift-assignments/mine] failed:', error.message);
    return serverError('טעינת המשמרות נכשלה');
  }

  return NextResponse.json({ shiftAssignments: data });
}
