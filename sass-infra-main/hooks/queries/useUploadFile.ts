'use client';

import { useMutation } from '@tanstack/react-query';
import type { FileRow } from '@/types/database.types';
import type { BucketName } from '@/lib/storage/config';

export interface UploadFileInput {
  file: File | Blob;
  bucket: BucketName;
  entityType: string;
  entityId: string;
  /** Required when `file` is a Blob, which carries no name. */
  filename?: string;
}

/**
 * Uploads through /api/files/upload. FormData, so no Content-Type header —
 * the browser sets the multipart boundary itself.
 */
export function useUploadFile() {
  return useMutation({
    mutationFn: async (input: UploadFileInput): Promise<FileRow> => {
      const form = new FormData();
      const name =
        input.filename ?? (input.file instanceof File ? input.file.name : 'upload');

      form.append('file', input.file, name);
      form.append('bucket', input.bucket);
      form.append('entityType', input.entityType);
      form.append('entityId', input.entityId);

      const response = await fetch('/api/files/upload', { method: 'POST', body: form });
      const json = await response.json();

      if (!response.ok) throw new Error(json.error || 'העלאת הקובץ נכשלה');
      return json.file as FileRow;
    },
  });
}
