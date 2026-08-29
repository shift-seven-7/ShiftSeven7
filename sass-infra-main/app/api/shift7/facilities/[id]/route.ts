import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, forbidden, getAuthInfo, requireApproved, serverError } from '@/lib/api/auth';
import type { FacilityRow } from '@/types/database.types';

type FacilityUpdate = Partial<Omit<FacilityRow, 'id' | 'created_at' | 'updated_at' | 'created_by'>>;
const ALLOWED_FIELDS: (keyof FacilityUpdate)[] = ['name', 'code', 'address', 'status'];

async function isShift7Admin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.rpc('is_shift7_admin');
  return data === true;
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
  if (!(await isShift7Admin(supabase))) return forbidden('רק מנהל Shift7 יכול לערוך מתקנים');

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  const patch: FacilityUpdate = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) (patch as Record<string, unknown>)[field] = body[field];
  }
  if (Object.keys(patch).length === 0) return badRequest('אין שדות לעדכון');

  const { data, error } = await supabase.from('facilities').update(patch).eq('id', id).select().maybeSingle();

  if (error) {
    console.error('[api/shift7/facilities/:id] update failed:', error.message);
    return serverError('עדכון המתקן נכשל');
  }
  return NextResponse.json({ facility: data });
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
  if (!(await isShift7Admin(supabase))) return forbidden('רק מנהל Shift7 יכול להסיר מתקנים');

  const { error } = await supabase.from('facilities').delete().eq('id', id);

  if (error) {
    console.error('[api/shift7/facilities/:id] delete failed:', error.message);
    return serverError('הסרת המתקן נכשלה');
  }
  return NextResponse.json({ success: true });
}
