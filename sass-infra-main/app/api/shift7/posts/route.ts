import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, forbidden, getAuthInfo, requireApproved, serverError } from '@/lib/api/auth';
import type { PostRow } from '@/types/database.types';

type PostInsert = Pick<PostRow, 'name' | 'code' | 'type' | 'facility' | 'required_role'> &
  Partial<Omit<PostRow, 'id' | 'created_at' | 'updated_at' | 'created_by'>>;

async function isShift7Admin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.rpc('is_shift7_admin');
  return data === true;
}

export async function GET() {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const { data, error } = await supabase.from('posts').select('*').order('name');

  if (error) {
    console.error('[api/shift7/posts] list failed:', error.message);
    return serverError('טעינת רשימת העמדות נכשלה');
  }

  return NextResponse.json({ posts: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;
  if (!(await isShift7Admin(supabase))) return forbidden('רק מנהל Shift7 יכול להוסיף עמדות');

  let body: PostInsert;
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  if (!body.name?.trim() || !body.code?.trim() || !body.facility || !body.type) {
    return badRequest('שם, קוד, סוג ומתקן הם שדות חובה');
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({ ...body, created_by: auth?.userId })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return badRequest(`קוד עמדה "${body.code}" כבר קיים במתקן זה`);
    }
    console.error('[api/shift7/posts] create failed:', error.message);
    return serverError('יצירת העמדה נכשלה');
  }

  return NextResponse.json({ post: data });
}
