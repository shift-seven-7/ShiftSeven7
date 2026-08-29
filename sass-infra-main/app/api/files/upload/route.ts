import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, getAuthInfo, requireApproved, serverError } from '@/lib/api/auth';
import {
  BUCKET_CONFIG,
  BUCKETS,
  buildStoragePath,
  isBucketName,
} from '@/lib/storage/config';

/**
 * Uploads a file to the current tenant's storage and records it in `files`.
 *
 * Runs as the signed-in user (not the service role) so Supabase Storage's own
 * policies apply on top of the checks here.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied || !auth) return denied ?? serverError();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  const file = form.get('file');
  const bucketRaw = String(form.get('bucket') ?? BUCKETS.MEDIA);
  const entityType = String(form.get('entityType') ?? 'misc');
  const entityId = String(form.get('entityId') ?? auth.userId);

  if (!(file instanceof File)) return badRequest('לא נבחר קובץ');
  if (!isBucketName(bucketRaw)) return badRequest('יעד אחסון לא תקין');

  const config = BUCKET_CONFIG[bucketRaw];

  if (file.size > config.maxSizeBytes) {
    const limitMb = Math.round(config.maxSizeBytes / (1024 * 1024));
    return badRequest(`הקובץ גדול מדי. הגודל המרבי הוא ${limitMb}MB`);
  }
  if (config.allowedMimeTypes && !config.allowedMimeTypes.includes(file.type)) {
    return badRequest('סוג הקובץ אינו נתמך');
  }

  const path = buildStoragePath({
    userId: auth.userId,
    entityType,
    entityId,
    filename: file.name,
  });

  const { error: uploadError } = await supabase.storage
    .from(config.name)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    console.error('[api/files/upload] storage upload failed:', uploadError.message);
    return serverError('העלאת הקובץ נכשלה');
  }

  // A public bucket yields a stable URL; a private one is fetched through a
  // signed URL at read time, so only the path is worth storing.
  const url = config.isPublic
    ? supabase.storage.from(config.name).getPublicUrl(path).data.publicUrl
    : path;

  const { data: record, error: recordError } = await supabase
    .from('files')
    .insert({
      name: path.split('/').pop() ?? file.name,
      original_name: file.name,
      mime_type: file.type,
      size: file.size,
      bucket: config.name,
      path,
      url,
      user_id: auth.userId,
      entity_type: entityType,
      entity_id: entityId,
      is_public: config.isPublic,
    })
    .select()
    .single();

  if (recordError) {
    // The object is already in storage; leaving the row out would orphan it.
    // Remove the object so a retry is clean.
    await supabase.storage.from(config.name).remove([path]);
    console.error('[api/files/upload] record insert failed:', recordError.message);
    return serverError('שמירת פרטי הקובץ נכשלה');
  }

  return NextResponse.json({ file: record });
}
