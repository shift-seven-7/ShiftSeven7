import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, forbidden, getAuthInfo, requireApproved, serverError } from '@/lib/api/auth';
import type { ShiftTemplateRow } from '@/types/database.types';

type ShiftTemplateUpdate = Partial<Omit<ShiftTemplateRow, 'id' | 'created_at' | 'updated_at' | 'created_by'>>;
const ALLOWED_FIELDS: (keyof ShiftTemplateUpdate)[] = [
  'code',
  'name',
  'category',
  'start_time',
  'end_time',
  'duration_hours',
  'post_number',
  'color',
  'applicable_roles',
  'facility',
];

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
  if (!(await isShift7Admin(supabase))) return forbidden('רק מנהל Shift7 יכול לערוך תבניות משמרת');

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  const patch: ShiftTemplateUpdate = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) (patch as Record<string, unknown>)[field] = body[field];
  }
  if (Object.keys(patch).length === 0) return badRequest('אין שדות לעדכון');

  const { data, error } = await supabase
    .from('shift_templates')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('[api/shift7/shift-templates/:id] update failed:', error.message);
    return serverError('עדכון תבנית המשמרת נכשל');
  }
  return NextResponse.json({ shiftTemplate: data });
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
  if (!(await isShift7Admin(supabase))) return forbidden('רק מנהל Shift7 יכול להסיר תבניות משמרת');

  const { error } = await supabase.from('shift_templates').delete().eq('id', id);

  if (error) {
    console.error('[api/shift7/shift-templates/:id] delete failed:', error.message);
    return serverError('הסרת תבנית המשמרת נכשלה');
  }
  return NextResponse.json({ success: true });
}
