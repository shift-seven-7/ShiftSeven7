import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, forbidden, getAuthInfo, requireApproved, serverError } from '@/lib/api/auth';
import type { StaffRow } from '@/types/database.types';

/**
 * Staff roster — list and create.
 *
 * requireApproved() is the platform-level gate (any signed-in, approved
 * user may call this route); RLS on public.staff narrows what a plain
 * employee actually gets back to their own row. Write access is gated here
 * *and* by RLS's "shift7 admins write staff" policy — this check exists so a
 * non-admin gets a clear Hebrew error instead of a bare RLS-denied insert.
 */

type StaffInsert = Pick<StaffRow, 'full_name' | 'role' | 'primary_facility'> &
  Partial<Omit<StaffRow, 'id' | 'created_at' | 'updated_at' | 'created_by'>>;

async function isShift7Admin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.rpc('is_shift7_admin');
  return data === true;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const search = request.nextUrl.searchParams.get('search')?.trim();

  let query = supabase.from('staff').select('*').order('full_name');
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,employee_id.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[api/shift7/staff] list failed:', error.message);
    return serverError('טעינת רשימת הצוות נכשלה');
  }

  return NextResponse.json({ staff: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;
  if (!(await isShift7Admin(supabase))) return forbidden('רק מנהל Shift7 יכול להוסיף אנשי צוות');

  let body: StaffInsert;
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  if (!body.full_name?.trim() || !body.role || !body.primary_facility) {
    return badRequest('שם מלא, תפקיד ומתקן ראשי הם שדות חובה');
  }

  // Auto-assign the next free numeric employee_id when the caller leaves it
  // blank, matching the original app's behavior. Done here (not client-side)
  // so it's still correct under concurrent creates against the authoritative
  // row set, not a possibly-stale client-side list.
  let employeeId = body.employee_id?.trim();
  if (!employeeId) {
    const { data: existing } = await supabase.from('staff').select('employee_id');
    const used = new Set((existing ?? []).map((row) => row.employee_id));
    let candidate = 1;
    for (const row of existing ?? []) {
      const n = parseInt(row.employee_id, 10);
      if (!Number.isNaN(n) && n >= candidate) candidate = n + 1;
    }
    while (used.has(String(candidate))) candidate++;
    employeeId = String(candidate);
  }

  const { data, error } = await supabase
    .from('staff')
    .insert({ ...body, employee_id: employeeId, created_by: auth?.userId })
    .select()
    .single();

  if (error) {
    // Postgres unique_violation — employee_id is UNIQUE.
    if (error.code === '23505') {
      return badRequest(`מספר עובד "${employeeId}" כבר קיים במערכת`);
    }
    console.error('[api/shift7/staff] create failed:', error.message);
    return serverError('יצירת איש הצוות נכשלה');
  }

  return NextResponse.json({ staffMember: data });
}
