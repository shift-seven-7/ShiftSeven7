import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, forbidden, getAuthInfo, requireApproved, serverError } from '@/lib/api/auth';
import type { ShiftTemplateRow } from '@/types/database.types';

type ShiftTemplateInsert = Pick<
  ShiftTemplateRow,
  'code' | 'name' | 'category' | 'start_time' | 'end_time' | 'duration_hours' | 'applicable_roles'
> &
  Partial<Omit<ShiftTemplateRow, 'id' | 'created_at' | 'updated_at' | 'created_by'>>;

/** Matches the source app's `validateShiftCode`: 1-3 letters, optional trailing digit. */
function isValidShiftCode(code: string): boolean {
  return /^[A-Za-z]{1,3}\d?$/.test(code);
}

async function isShift7Admin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.rpc('is_shift7_admin');
  return data === true;
}

export async function GET() {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const { data, error } = await supabase.from('shift_templates').select('*').order('code');

  if (error) {
    console.error('[api/shift7/shift-templates] list failed:', error.message);
    return serverError('טעינת תבניות המשמרת נכשלה');
  }

  return NextResponse.json({ shiftTemplates: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;
  if (!(await isShift7Admin(supabase))) return forbidden('רק מנהל Shift7 יכול להוסיף תבניות משמרת');

  let body: ShiftTemplateInsert;
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  if (!body.code || !isValidShiftCode(body.code)) {
    return badRequest('קוד משמרת בלתי חוקי. השתמש ב-1-3 אותיות ובאופציונלית ספרה (לדוגמה: M, A1, N)');
  }
  if (!body.name?.trim() || !body.category || !body.start_time || !body.end_time) {
    return badRequest('שם, קטגוריה ושעות התחלה/סיום הם שדות חובה');
  }

  const { data, error } = await supabase
    .from('shift_templates')
    .insert({ ...body, created_by: auth?.userId })
    .select()
    .single();

  if (error) {
    console.error('[api/shift7/shift-templates] create failed:', error.message);
    return serverError('יצירת תבנית המשמרת נכשלה');
  }

  return NextResponse.json({ shiftTemplate: data });
}
