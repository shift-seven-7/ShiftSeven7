import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, forbidden, getAuthInfo, notFound, requireApproved, serverError } from '@/lib/api/auth';

async function isShift7SchedulerOrAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const { data } = await supabase.rpc('is_shift7_scheduler_or_admin');
  return data === true;
}

/**
 * Two, mutually exclusive, request shapes:
 *   - { notes } — the requester editing their own request, only while it's
 *     still 'pending' (RLS: "shift7 staff update own pending employee_requests").
 *   - { status, manager_comment } — admin/scheduler approving or rejecting
 *     (RLS: "shift7 admins and schedulers update employee_requests"). This is
 *     the ONLY path that may ever set status/manager_comment/handled_by — see
 *     the migration's note on why employee_requests RLS was split this way.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  let body: {
    notes?: string;
    status?: 'approved' | 'rejected';
    manager_comment?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  if (body.status) {
    if (!(await isShift7SchedulerOrAdmin(supabase))) {
      return forbidden('רק מנהל או משבץ Shift7 יכולים לאשר או לדחות בקשות');
    }
    if (body.status !== 'approved' && body.status !== 'rejected') {
      return badRequest('סטטוס לא תקין');
    }

    const { data: request_, error: fetchError } = await supabase
      .from('employee_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) return serverError('טעינת הבקשה נכשלה');
    if (!request_) return notFound('הבקשה לא נמצאה');

    const { data: updated, error } = await supabase
      .from('employee_requests')
      .update({
        status: body.status,
        manager_comment: body.manager_comment || null,
        handled_by: auth!.userId,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[api/shift7/employee-requests/:id] decision failed:', error.message);
      return serverError('עדכון הבקשה נכשל');
    }

    // On approval of an absence request, cancel the employee's existing shift
    // assignments within the approved date range so the schedule reflects the
    // absence immediately — matches the original app's behavior.
    let cancelledCount = 0;
    if (body.status === 'approved' && request_.start_date) {
      const end = request_.end_date || request_.start_date;
      const { data: conflicting } = await supabase
        .from('shift_assignments')
        .select('id')
        .eq('staff_id', request_.staff_id)
        .gte('date', request_.start_date)
        .lte('date', end)
        .neq('status', 'cancelled');

      const ids = (conflicting ?? []).map((a) => a.id);
      if (ids.length > 0) {
        const { error: cancelError } = await supabase
          .from('shift_assignments')
          .update({
            status: 'cancelled',
            is_emergency_override: true,
            override_reason: `בקשה שאושרה: ${request_.type}`,
          })
          .in('id', ids);
        // Best-effort: the approval itself already succeeded and shouldn't
        // roll back over a cascade failure the admin can fix by hand.
        if (!cancelError) cancelledCount = ids.length;
      }
    }

    return NextResponse.json({ employeeRequest: updated, cancelledAssignments: cancelledCount });
  }

  // Owner self-edit path — RLS confines this to their own, still-pending row.
  if (body.notes === undefined) return badRequest('אין שדות לעדכון');

  const { data, error } = await supabase
    .from('employee_requests')
    .update({ notes: body.notes || null })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('[api/shift7/employee-requests/:id] self-edit failed:', error.message);
    return serverError('עדכון הבקשה נכשל');
  }
  if (!data) return notFound('הבקשה לא נמצאה או שאינה ניתנת לעריכה יותר');

  return NextResponse.json({ employeeRequest: data });
}

/** Withdraw a request — RLS confines this to the caller's own, still-pending rows. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const { error } = await supabase.from('employee_requests').delete().eq('id', id);

  if (error) {
    console.error('[api/shift7/employee-requests/:id] delete failed:', error.message);
    return serverError('מחיקת הבקשה נכשלה');
  }
  return NextResponse.json({ success: true });
}
