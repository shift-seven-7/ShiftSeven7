'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { AccountDisabledError } from '@/hooks/queries/useMe';
import {
  canAccessRoute,
  PENDING_APPROVAL_ROUTE,
  PLATFORM_ROUTE_PREFIX,
} from '@/lib/constants/permissions';
import { AppShell } from '@/components/layout/AppShell';

/**
 * The client-side route guard for everything under /app.
 *
 * Four gates, in order:
 *   1. authenticated and approved (a null role goes to the waiting page)
 *   2. the role may reach this route      (ROUTE_PERMISSIONS)
 *   3. the tenant has the required module (ROUTE_FEATURES)
 *   4. platform routes need a platform operator, not just a role
 *
 * This is UX, not security. It stops a user from landing on a page that would
 * fail anyway; the data behind every page is protected by the route's own role
 * check and by RLS.
 */
export function ProtectedAppLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { role, isLoading, error, getHomePage, isRouteFeatureEnabled, isPlatformOperator } =
    usePermissions();

  const isPendingPage = pathname === PENDING_APPROVAL_ROUTE;

  useEffect(() => {
    if (isLoading) return;

    if (error) {
      // A disabled account is signed out and told why; anything else means no
      // usable session.
      if (error instanceof AccountDisabledError) {
        fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
          window.location.href = '/auth/login?disabled=1';
        });
        return;
      }
      window.location.href = '/auth/login';
      return;
    }

    if (!role) {
      if (!isPendingPage) router.replace(PENDING_APPROVAL_ROUTE);
      return;
    }

    // An approved user has no reason to sit on the waiting page.
    if (isPendingPage) {
      router.replace(getHomePage());
      return;
    }

    // Gate 2: role. Gate 3: the tenant actually has the module.
    if (!canAccessRoute(pathname, role) || !isRouteFeatureEnabled(pathname)) {
      router.replace(getHomePage());
      return;
    }

    // Gate 4: the platform console is not part of the tenant's application.
    if (pathname.startsWith(PLATFORM_ROUTE_PREFIX) && !isPlatformOperator) {
      router.replace(getHomePage());
    }
  }, [
    isLoading,
    error,
    role,
    pathname,
    isPendingPage,
    router,
    getHomePage,
    isRouteFeatureEnabled,
    isPlatformOperator,
  ]);

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="text-muted-foreground">טוען...</div>
      </div>
    );
  }

  // Redirecting — render nothing rather than flashing a page the user will be
  // bounced off.
  if (error || (!role && !isPendingPage)) return null;

  return <AppShell>{children}</AppShell>;
}
