import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, forbidden, getAuthInfo, requireApproved, serverError } from '@/lib/api/auth';
import { notifyShift7SchedulePublished } from '@/lib/shift7/notifications';

async function isShift7SchedulerOrAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.rpc('is_shift7_scheduler_or_admin');
  return data === true;
}

/**
 * Bulk-publish: sets is_published = true on the given ids, then fires the
 * Slack notification. Notification content (week label, facility name, staff
 * names) is computed client-side, since the DB write is the only part that
 * needs to be authoritative — same reasoning as the original app's
 * notifySchedulePublished call site in smart-schedule.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;
  if (!(await isShift7SchedulerOrAdmin(supabase))) {
    return forbidden('רק מנהל או משבץ Shift7 יכולים לפרסם סידור');
  }

  let body: {
    ids?: string[];
    weekLabel?: string;
    facilityName?: string;
    staffNames?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  if (!body.ids?.length) return badRequest('לא נבחרו שיבוצים לפרסום');

  const { data, error } = await supabase
    .from('shift_assignments')
    .update({ is_published: true })
    .in('id', body.ids)
    .select('id');

  if (error) {
    console.error('[api/shift7/shift-assignments/publish] failed:', error.message);
    return serverError('פרסום הסידור נכשל');
  }

  await notifyShift7SchedulePublished({
    weekLabel: body.weekLabel ?? '',
    facilityName: body.facilityName,
    shiftCount: data.length,
    staffNames: body.staffNames,
  });

  return NextResponse.json({ published: data.length });
}
