import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, forbidden, getAuthInfo, requireApproved, serverError } from '@/lib/api/auth';
import type { Shift7ConfigCategory } from '@/types/database.types';

interface UpsertConfig {
  key: string;
  value: string;
  description?: string | null;
  category: Shift7ConfigCategory;
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

  const { data, error } = await supabase.from('system_config').select('*');

  if (error) {
    console.error('[api/shift7/system-config] list failed:', error.message);
    return serverError('טעינת ההגדרות נכשלה');
  }

  return NextResponse.json({ systemConfig: data });
}

/** Upsert-by-key, matching the page's "edit a value, save it" flow — one key at a time. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;
  if (!(await isShift7Admin(supabase))) return forbidden('רק מנהל Shift7 יכול לערוך הגדרות');

  let body: UpsertConfig;
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  if (!body.key || body.value === undefined || !body.category) {
    return badRequest('מפתח, ערך וקטגוריה הם שדות חובה');
  }

  const { data, error } = await supabase
    .from('system_config')
    .upsert(
      {
        key: body.key,
        value: body.value,
        description: body.description ?? null,
        category: body.category,
        created_by: auth?.userId,
      },
      { onConflict: 'key' }
    )
    .select()
    .single();

  if (error) {
    console.error('[api/shift7/system-config] upsert failed:', error.message);
    return serverError('שמירת ההגדרה נכשלה');
  }

  return NextResponse.json({ config: data });
}
