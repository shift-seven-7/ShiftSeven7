'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/hooks/usePermissions';

/**
 * /app itself has no content — it forwards to whichever landing page this
 * user's role and module set allow.
 */
export default function AppIndexPage() {
  const router = useRouter();
  const { isLoading, getHomePage } = usePermissions();

  useEffect(() => {
    if (!isLoading) router.replace(getHomePage());
  }, [isLoading, router, getHomePage]);

  return null;
}
