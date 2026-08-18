import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, forbidden, getAuthInfo, requireApproved, serverError } from '@/lib/api/auth';
import type { FacilityRow } from '@/types/database.types';

/**
 * Facility reference list + create. RLS (shift7 read reference data, on
 * public.facilities) already scopes reads to callers holding an active
 * Shift7 role — requireApproved() is the platform-level gate, RLS is the
 * module-level one. Writes are additionally gated here for a clear Hebrew
 * error, matching the staff route's pattern.
 */

type FacilityInsert = Pick<FacilityRow, 'name' | 'code'> &
  Partial<Omit<FacilityRow, 'id' | 'created_at' | 'updated_at' | 'created_by'>>;

async function isShift7Admin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.rpc('is_shift7_admin');
  return data === true;
}

export async function GET() {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const { data, error } = await supabase.from('facilities').select('*').order('name');

  if (error) {
    console.error('[api/shift7/facilities] list failed:', error.message);
    return serverError('טעינת המתקנים נכשלה');
  }

  return NextResponse.json({ facilities: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;
  if (!(await isShift7Admin(supabase))) return forbidden('רק מנהל Shift7 יכול להוסיף מתקנים');

  let body: FacilityInsert;
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  if (!body.name?.trim() || !body.code?.trim()) {
    return badRequest('שם וקוד הם שדות חובה');
  }

  const { data, error } = await supabase
    .from('facilities')
    .insert({ ...body, created_by: auth?.userId })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return badRequest(`קוד מתקן "${body.code}" כבר קיים`);
    console.error('[api/shift7/facilities] create failed:', error.message);
    return serverError('יצירת המתקן נכשלה');
  }

  return NextResponse.json({ facility: data });
}
