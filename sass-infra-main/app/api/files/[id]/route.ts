import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAuthInfo, notFound, requireApproved, serverError } from '@/lib/api/auth';

/**
 * Resolves a file id to a fetchable URL and redirects to it.
 *
 * Two-step, deliberately: step 1 uses the SESSION client, so `public.files`'
 * own RLS (files_select — owner, admin, is_public, plus whatever a module
 * like Shift7 additively grants) is the actual authorization check. Step 2
 * uses the SERVICE-ROLE client purely to reach Storage — there are no
 * storage.objects RLS policies in this project at all, so a session client
 * could not read a private object's bytes even for a row it's allowed to
 * see. This keeps Storage access behind one code path (this route) instead
 * of needing a second, separately-maintained set of policies that has to
 * agree with `public.files`' row-level rules.
 *
 * A public-bucket file already has a stable URL stored on the row — no
 * signing needed, this just redirects to it. A private-bucket file gets a
 * short-lived signed URL instead.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const { data: file, error } = await supabase
    .from('files')
    .select('bucket, path, url, is_public')
    .eq('id', id)
    .maybeSingle();

  if (error) return serverError('טעינת הקובץ נכשלה');
  // RLS already filters this to "not visible to this caller" vs "doesn't
  // exist" — both surface as no row, and both should read as 404, not 403,
  // so a caller can't distinguish "no permission" from "never existed".
  if (!file) return notFound('הקובץ לא נמצא');

  if (file.is_public) {
    return NextResponse.redirect(file.url);
  }

  const service = await createServiceClient();
  const { data: signed, error: signError } = await service.storage
    .from(file.bucket)
    .createSignedUrl(file.path, 60);

  if (signError || !signed) {
    console.error('[api/files/:id] sign failed:', signError?.message);
    return serverError('יצירת קישור להורדה נכשלה');
  }

  return NextResponse.redirect(signed.signedUrl);
}
