/**
 * Storage bucket configuration.
 *
 * These buckets are created on every new tenant project by the
 * `buckets_created` provisioning step (lib/services/tenant-setup-steps.ts), so
 * this list and that step must agree.
 */

export interface BucketConfig {
  name: string;
  /** Public buckets serve a permanent URL; private ones need a signed URL. */
  isPublic: boolean;
  maxSizeBytes: number;
  allowedMimeTypes: string[] | null;
}

const MB = 1024 * 1024;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

export const BUCKETS = {
  /** Profile pictures and the tenant logo. */
  AVATARS: 'avatars',
  /** General user-facing media. */
  MEDIA: 'media',
  /** Anything that should not be world-readable. */
  DOCUMENTS: 'documents',
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

export const BUCKET_CONFIG: Record<BucketName, BucketConfig> = {
  [BUCKETS.AVATARS]: {
    name: BUCKETS.AVATARS,
    isPublic: true,
    maxSizeBytes: 10 * MB,
    allowedMimeTypes: IMAGE_TYPES,
  },
  [BUCKETS.MEDIA]: {
    name: BUCKETS.MEDIA,
    isPublic: true,
    maxSizeBytes: 50 * MB,
    allowedMimeTypes: null,
  },
  [BUCKETS.DOCUMENTS]: {
    name: BUCKETS.DOCUMENTS,
    isPublic: false,
    maxSizeBytes: 50 * MB,
    allowedMimeTypes: null,
  },
};

export const DEFAULT_STORAGE_BUCKETS = Object.values(BUCKET_CONFIG);

export function isBucketName(value: string): value is BucketName {
  return value in BUCKET_CONFIG;
}

/**
 * Where an upload lands.
 *
 * Namespaced by uploader first so Supabase Storage's own owner-based policies
 * line up with the `files` table's RLS.
 */
export function buildStoragePath(params: {
  userId: string;
  entityType: string;
  entityId: string;
  filename: string;
}): string {
  const safeName = params.filename.replace(/[^\w.\-]/g, '_');
  return `${params.userId}/${params.entityType}/${params.entityId}/${safeName}`;
}
