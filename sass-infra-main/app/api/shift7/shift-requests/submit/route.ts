import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, forbidden, getAuthInfo, requireApproved, serverError } from '@/lib/api/auth';

/** Marks the caller's own draft requests for a week as submitted, in one call. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  let body: { week_start?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }
  if (!body.week_start) return badRequest('week_start נדרש');

  const { data: me } = await supabase
    .from('staff')
    .select('id')
    .eq('user_id', auth!.userId)
    .maybeSingle();
  if (!me) return forbidden('אין לך רשומת עובד משויכת במערכת');

  const { error } = await supabase
    .from('shift_requests')
    .update({ status: 'submitted' })
    .eq('staff_id', me.id)
    .eq('week_start', body.week_start)
    .eq('status', 'draft');

  if (error) {
    console.error('[api/shift7/shift-requests/submit] failed:', error.message);
    return serverError('שליחת הבקשות נכשלה');
  }

  return NextResponse.json({ success: true });
}
