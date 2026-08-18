import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  badRequest,
  forbidden,
  getAuthInfo,
  notFound,
  requireApproved,
  serverError,
} from '@/lib/api/auth';
import type { StaffRow } from '@/types/database.types';

type StaffUpdate = Partial<
  Omit<StaffRow, 'id' | 'employee_id' | 'created_at' | 'updated_at' | 'created_by'>
>;

async function isShift7Admin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.rpc('is_shift7_admin');
  return data === true;
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

  const { data, error } = await supabase.from('staff').select('*').eq('id', id).maybeSingle();

  if (error) return serverError('טעינת איש הצוות נכשלה');
  if (!data) return notFound('איש הצוות לא נמצא');

  return NextResponse.json({ staffMember: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;
  if (!(await isShift7Admin(supabase))) return forbidden('רק מנהל Shift7 יכול לערוך אנשי צוות');

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  // employee_id is deliberately not accepted here — it's permanent once set,
  // matching the original app's behavior (see the "(קבוע)" label on the form).
  // Built as an allow-list rather than spreading the body, same reasoning as
  // app/api/users/[id]/route.ts.
  const patch: StaffUpdate = {};
  const ALLOWED_FIELDS: (keyof StaffUpdate)[] = [
    'full_name',
    'role',
    'qualification',
    'primary_facility',
    'phone',
    'email',
    'status',
    'access_level',
    'weapon_license_expiry',
    'weapon_refresh_expiry',
    'medical_check_expiry',
  ];
  for (const field of ALLOWED_FIELDS) {
    if (field in body) (patch as Record<string, unknown>)[field] = body[field];
  }

  if (Object.keys(patch).length === 0) {
    return badRequest('אין שדות לעדכון');
  }

  const { data, error } = await supabase
    .from('staff')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('[api/shift7/staff/:id] update failed:', error.message);
    return serverError('עדכון איש הצוות נכשל');
  }
  if (!data) return notFound('איש הצוות לא נמצא');

  return NextResponse.json({ staffMember: data });
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
  if (!(await isShift7Admin(supabase))) return forbidden('רק מנהל Shift7 יכול להסיר אנשי צוות');

  const { error } = await supabase.from('staff').delete().eq('id', id);

  if (error) {
    console.error('[api/shift7/staff/:id] delete failed:', error.message);
    return serverError('הסרת איש הצוות נכשלה');
  }

  return NextResponse.json({ success: true });
}
