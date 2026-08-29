import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthInfo, requireApproved, serverError } from '@/lib/api/auth';

/** Delete a single day's request — RLS scopes this to the caller's own rows. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const { error } = await supabase.from('shift_requests').delete().eq('id', id);

  if (error) {
    console.error('[api/shift7/shift-requests/:id] delete failed:', error.message);
    return serverError('מחיקת הבקשה נכשלה');
  }

  return NextResponse.json({ success: true });
}
