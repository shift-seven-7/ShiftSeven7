import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, forbidden, getAuthInfo, requireApproved, serverError } from '@/lib/api/auth';
import type { Shift7Category, Shift7DayGroup } from '@/types/database.types';

interface UpsertSlot {
  facility_id: string;
  day_group: Shift7DayGroup;
  category: Shift7Category;
  supervisor: number;
  guard: number;
  dispatcher: number;
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

  const { data, error } = await supabase.from('staffing_requirements').select('*');

  if (error) {
    console.error('[api/shift7/staffing-requirements] list failed:', error.message);
    return serverError('טעינת התקינה נכשלה');
  }

  return NextResponse.json({ staffingRequirements: data });
}

/**
 * Upsert one facility/day/category slot. The page edits many slots at once
 * and saves them individually — one row per call keeps each save's error
 * isolated to the slot that failed, rather than one failure rolling back a
 * whole batch.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;
  if (!(await isShift7Admin(supabase))) return forbidden('רק מנהל Shift7 יכול לערוך תקינה');

  let body: UpsertSlot;
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  if (!body.facility_id || !body.day_group || !body.category) {
    return badRequest('מתקן, קבוצת ימים וקטגוריה הם שדות חובה');
  }

  const { data, error } = await supabase
    .from('staffing_requirements')
    .upsert(
      {
        facility_id: body.facility_id,
        day_group: body.day_group,
        category: body.category,
        supervisor: Math.max(0, body.supervisor || 0),
        guard: Math.max(0, body.guard || 0),
        dispatcher: Math.max(0, body.dispatcher || 0),
        created_by: auth?.userId,
      },
      { onConflict: 'facility_id,day_group,category' }
    )
    .select()
    .single();

  if (error) {
    console.error('[api/shift7/staffing-requirements] upsert failed:', error.message);
    return serverError('שמירת התקינה נכשלה');
  }

  return NextResponse.json({ staffingRequirement: data });
}
