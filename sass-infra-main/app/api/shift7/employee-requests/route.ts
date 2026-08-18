import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, forbidden, getAuthInfo, requireApproved, serverError } from '@/lib/api/auth';
import type { Shift7EmployeeRequestType } from '@/types/database.types';

async function isShift7SchedulerOrAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const { data } = await supabase.rpc('is_shift7_scheduler_or_admin');
  return data === true;
}

/**
 * `?scope=all` — every request, for admin/scheduler review (manage-requests).
 * Default — only the caller's own requests (requests / my-area). RLS backs
 * both: "shift7 admins and schedulers read all employee_requests" and
 * "shift7 staff read own employee_requests" are separate SELECT policies.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const scope = request.nextUrl.searchParams.get('scope');

  if (scope === 'all') {
    if (!(await isShift7SchedulerOrAdmin(supabase))) {
      return forbidden('רק מנהל או משבץ Shift7 יכולים לראות את כל הבקשות');
    }
    const { data, error } = await supabase
      .from('employee_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[api/shift7/employee-requests] list-all failed:', error.message);
      return serverError('טעינת הבקשות נכשלה');
    }
    return NextResponse.json({ employeeRequests: data });
  }

  const { data: me } = await supabase
    .from('staff')
    .select('id')
    .eq('user_id', auth!.userId)
    .maybeSingle();
  if (!me) return NextResponse.json({ employeeRequests: [] });

  const { data, error } = await supabase
    .from('employee_requests')
    .select('*')
    .eq('staff_id', me.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[api/shift7/employee-requests] list-mine failed:', error.message);
    return serverError('טעינת הבקשות נכשלה');
  }
  return NextResponse.json({ employeeRequests: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const { data: me } = await supabase
    .from('staff')
    .select('id, full_name')
    .eq('user_id', auth!.userId)
    .maybeSingle();
  if (!me) return forbidden('אין לך רשומת עובד משויכת במערכת');

  let body: {
    type?: Shift7EmployeeRequestType;
    start_date?: string | null;
    end_date?: string | null;
    notes?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  if (!body.type) return badRequest('יש לבחור סוג בקשה');

  const { data, error } = await supabase
    .from('employee_requests')
    .insert({
      staff_id: me.id,
      staff_name: me.full_name,
      type: body.type,
      status: 'pending',
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      notes: body.notes || null,
      created_by: auth!.userId,
    })
    .select()
    .single();

  if (error) {
    console.error('[api/shift7/employee-requests] create failed:', error.message);
    return serverError('שליחת הבקשה נכשלה');
  }

  return NextResponse.json({ employeeRequest: data });
}
