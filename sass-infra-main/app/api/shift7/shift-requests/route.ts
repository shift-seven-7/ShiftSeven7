import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, forbidden, getAuthInfo, requireApproved, serverError } from '@/lib/api/auth';

/**
 * Weekly shift requests (availability submissions) — self-service. RLS's
 * "shift7 staff manage own shift_requests" already scopes every operation to
 * the caller's own staff_id; this route resolves that staff_id server-side
 * (never trusts a client-supplied one) so a mismatch is a clear 403 instead
 * of an opaque RLS-denied write.
 */
async function myStaffRow(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('staff')
    .select('id, full_name, primary_facility, role')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const weekStart = request.nextUrl.searchParams.get('week_start');
  if (!weekStart) return badRequest('week_start נדרש');

  const me = await myStaffRow(supabase, auth!.userId);
  if (!me) return NextResponse.json({ shiftRequests: [] });

  const { data, error } = await supabase
    .from('shift_requests')
    .select('*')
    .eq('staff_id', me.id)
    .eq('week_start', weekStart);

  if (error) {
    console.error('[api/shift7/shift-requests] list failed:', error.message);
    return serverError('טעינת הבקשות נכשלה');
  }

  return NextResponse.json({ shiftRequests: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const me = await myStaffRow(supabase, auth!.userId);
  if (!me) return forbidden('אין לך רשומת עובד משויכת במערכת');

  let body: {
    week_start?: string;
    date?: string;
    shift_template_id?: string;
    shift_code?: string;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  if (!body.week_start || !body.date || !body.shift_template_id || !body.shift_code) {
    return badRequest('שבוע, תאריך ותבנית משמרת הם שדות חובה');
  }

  // One request per day: replace whatever's there for that date, rather than
  // erroring — matches the original page's toggle-a-day behavior.
  await supabase
    .from('shift_requests')
    .delete()
    .eq('staff_id', me.id)
    .eq('date', body.date);

  const { data, error } = await supabase
    .from('shift_requests')
    .insert({
      staff_id: me.id,
      staff_name: me.full_name,
      facility_id: me.primary_facility,
      week_start: body.week_start,
      date: body.date,
      shift_template_id: body.shift_template_id,
      shift_code: body.shift_code,
      status: 'draft',
      created_by: auth!.userId,
    })
    .select()
    .single();

  if (error) {
    console.error('[api/shift7/shift-requests] create failed:', error.message);
    return serverError('שמירת הבקשה נכשלה');
  }

  return NextResponse.json({ shiftRequest: data });
}
