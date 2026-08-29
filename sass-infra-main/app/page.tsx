'use client';

/**
 * Apex / fallback landing page.
 *
 * A tenant request never reaches this: proxy.ts redirects authenticated users
 * to their home page and everyone else to /auth/login. This renders only on the
 * bare base domain, where no tenant was resolved.
 */

import { APP_NAME, APP_DESCRIPTION } from '@/lib/constants/app';

export default function RootPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-foreground">{APP_NAME}</h1>
        <p className="text-muted-foreground">{APP_DESCRIPTION}</p>
      </div>
    </main>
  );
}
