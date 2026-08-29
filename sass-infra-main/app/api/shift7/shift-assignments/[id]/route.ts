import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, forbidden, getAuthInfo, notFound, requireApproved, serverError } from '@/lib/api/auth';
import type { ShiftAssignmentRow } from '@/types/database.types';

type AssignmentUpdate = Partial<
  Pick<ShiftAssignmentRow, 'actual_start' | 'actual_end' | 'override_reason' | 'status'>
>;

async function isShift7SchedulerOrAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.rpc('is_shift7_scheduler_or_admin');
  return data === true;
}

/** Edit an assignment's times/note from the smart-schedule matrix popover. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;
  if (!(await isShift7SchedulerOrAdmin(supabase))) {
    return forbidden('רק מנהל או משבץ Shift7 יכולים לערוך שיבוץ');
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  const patch: AssignmentUpdate = {};
  const ALLOWED_FIELDS: (keyof AssignmentUpdate)[] = [
    'actual_start',
    'actual_end',
    'override_reason',
    'status',
  ];
  for (const field of ALLOWED_FIELDS) {
    if (field in body) (patch as Record<string, unknown>)[field] = body[field];
  }
  if (Object.keys(patch).length === 0) return badRequest('אין שדות לעדכון');

  const { data, error } = await supabase
    .from('shift_assignments')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('[api/shift7/shift-assignments/:id] update failed:', error.message);
    return serverError('עדכון השיבוץ נכשל');
  }
  if (!data) return notFound('השיבוץ לא נמצא');

  return NextResponse.json({ shiftAssignment: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;
  if (!(await isShift7SchedulerOrAdmin(supabase))) {
    return forbidden('רק מנהל או משבץ Shift7 יכולים להסיר שיבוץ');
  }

  const { error } = await supabase.from('shift_assignments').delete().eq('id', id);

  if (error) {
    console.error('[api/shift7/shift-assignments/:id] delete failed:', error.message);
    return serverError('הסרת השיבוץ נכשלה');
  }

  return NextResponse.json({ success: true });
}
