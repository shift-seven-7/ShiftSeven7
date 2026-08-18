import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, forbidden, getAuthInfo, requireApproved, serverError } from '@/lib/api/auth';
import type { PostRow } from '@/types/database.types';

type PostUpdate = Partial<Omit<PostRow, 'id' | 'created_at' | 'updated_at' | 'created_by'>>;
const ALLOWED_FIELDS: (keyof PostUpdate)[] = ['name', 'code', 'type', 'facility', 'required_role', 'status'];

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
  if (!(await isShift7Admin(supabase))) return forbidden('רק מנהל Shift7 יכול לערוך עמדות');

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  const patch: PostUpdate = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) (patch as Record<string, unknown>)[field] = body[field];
  }
  if (Object.keys(patch).length === 0) return badRequest('אין שדות לעדכון');

  const { data, error } = await supabase.from('posts').update(patch).eq('id', id).select().maybeSingle();

  if (error) {
    console.error('[api/shift7/posts/:id] update failed:', error.message);
    return serverError('עדכון העמדה נכשל');
  }
  return NextResponse.json({ post: data });
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
  if (!(await isShift7Admin(supabase))) return forbidden('רק מנהל Shift7 יכול להסיר עמדות');

  const { error } = await supabase.from('posts').delete().eq('id', id);

  if (error) {
    console.error('[api/shift7/posts/:id] delete failed:', error.message);
    return serverError('הסרת העמדה נכשלה');
  }
  return NextResponse.json({ success: true });
}
