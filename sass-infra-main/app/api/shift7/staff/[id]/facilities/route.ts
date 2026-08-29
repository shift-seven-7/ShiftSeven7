import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, forbidden, getAuthInfo, notFound, requireApproved, serverError } from '@/lib/api/auth';

/**
 * A staff member's facility memberships — additional facilities beyond
 * primary_facility (unchanged elsewhere) that they can also work at.
 *
 * Phase 1: UI-level filtering only (staff pickers, shift-request template
 * lists) — no constraint on shift_assignments/shift_requests yet.
 */

/** 'admin' | 'scheduler' | 'employee' | 'no_access' | null (no active staff row). */
async function getShift7Role(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const { data } = await supabase.rpc('current_shift7_role');
  return data;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const { data, error } = await supabase
    .from('staff_facilities')
    .select('facility_id')
    .eq('staff_id', id);

  if (error) return serverError('טעינת המתקנים של איש הצוות נכשלה');

  return NextResponse.json({ facilityIds: (data ?? []).map((row) => row.facility_id) });
}

/** Replaces the full set of facilities for this staff member, and its primary_facility. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const shift7Role = await getShift7Role(supabase);
  if (shift7Role !== 'admin' && shift7Role !== 'scheduler') {
    return forbidden('רק מנהל או משבץ Shift7 יכולים לערוך את המתקנים של איש צוות');
  }

  let body: { facilityIds?: string[]; primaryFacility?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  const facilityIds = Array.from(new Set(body.facilityIds ?? []));
  const primaryFacility = body.primaryFacility;

  if (facilityIds.length === 0) return badRequest('יש לבחור לפחות מתקן אחד');
  if (!primaryFacility || !facilityIds.includes(primaryFacility)) {
    return badRequest('המתקן הראשי חייב להיות אחד מהמתקנים שנבחרו');
  }

  const { data: staffMember, error: staffError } = await supabase
    .from('staff')
    .select('id, access_level')
    .eq('id', id)
    .maybeSingle();

  if (staffError) return serverError('טעינת איש הצוות נכשלה');
  if (!staffMember) return notFound('איש הצוות לא נמצא');

  // Same escalation guard as PATCH/DELETE/create-login on this staff row.
  if (shift7Role === 'scheduler' && staffMember.access_level === 'admin') {
    return forbidden('משבץ אינו יכול לערוך את המתקנים של איש צוות בעל הרשאת מנהל מערכת');
  }

  const { error: primaryError } = await supabase
    .from('staff')
    .update({ primary_facility: primaryFacility })
    .eq('id', id);

  if (primaryError) {
    console.error('[api/shift7/staff/:id/facilities] primary_facility update failed:', primaryError.message);
    return serverError('עדכון המתקן הראשי נכשל');
  }

  const { error: deleteError } = await supabase.from('staff_facilities').delete().eq('staff_id', id);

  if (deleteError) {
    console.error('[api/shift7/staff/:id/facilities] delete failed:', deleteError.message);
    return serverError('עדכון המתקנים נכשל');
  }

  const { error: insertError } = await supabase
    .from('staff_facilities')
    .insert(facilityIds.map((facilityId) => ({ staff_id: id, facility_id: facilityId })));

  if (insertError) {
    console.error('[api/shift7/staff/:id/facilities] insert failed:', insertError.message);
    return serverError('עדכון המתקנים נכשל');
  }

  return NextResponse.json({ facilityIds, primaryFacility });
}
