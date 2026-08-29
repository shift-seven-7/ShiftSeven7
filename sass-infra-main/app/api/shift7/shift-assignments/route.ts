import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, forbidden, getAuthInfo, requireApproved, serverError } from '@/lib/api/auth';
import type { ShiftAssignmentRow } from '@/types/database.types';

/**
 * Shift assignments — list (date range, optional facility) and create.
 *
 * RLS already does the real scoping (admin/scheduler: everything;
 * employee: only their own published rows) — requireApproved() is just the
 * platform-level gate. Writes are additionally checked here for a clear
 * Hebrew error, same pattern as every other Shift7 route.
 */

type AssignmentInsert = Pick<
  ShiftAssignmentRow,
  'staff_id' | 'staff_name' | 'shift_template_id' | 'shift_code' | 'post_id' | 'facility_id' | 'date' | 'actual_start' | 'actual_end'
> &
  Partial<Omit<ShiftAssignmentRow, 'id' | 'created_at' | 'updated_at' | 'created_by'>>;

async function isShift7SchedulerOrAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.rpc('is_shift7_scheduler_or_admin');
  return data === true;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const from = params.get('from');
  const to = params.get('to') ?? from;
  const facilityId = params.get('facilityId');
  const staffId = params.get('staffId');

  if (!from || !to) return badRequest('יש לציין טווח תאריכים (from/to)');

  let query = supabase.from('shift_assignments').select('*').gte('date', from).lte('date', to);
  if (facilityId) query = query.eq('facility_id', facilityId);
  if (staffId) query = query.eq('staff_id', staffId);

  const { data, error } = await query;

  if (error) {
    console.error('[api/shift7/shift-assignments] list failed:', error.message);
    return serverError('טעינת השיבוצים נכשלה');
  }

  return NextResponse.json({ shiftAssignments: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;
  if (!(await isShift7SchedulerOrAdmin(supabase))) {
    return forbidden('רק מנהל או משבץ Shift7 יכולים לשבץ משמרות');
  }

  let body: AssignmentInsert;
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  if (
    !body.staff_id ||
    !body.staff_name ||
    !body.shift_template_id ||
    !body.shift_code ||
    !body.post_id ||
    !body.facility_id ||
    !body.date ||
    !body.actual_start ||
    !body.actual_end
  ) {
    return badRequest('חסרים שדות חובה לשיבוץ');
  }

  const { data, error } = await supabase
    .from('shift_assignments')
    .insert({ ...body, created_by: auth?.userId })
    .select()
    .single();

  if (error) {
    console.error('[api/shift7/shift-assignments] create failed:', error.message);
    return serverError('שיבוץ המשמרת נכשל');
  }

  return NextResponse.json({ shiftAssignment: data });
}
