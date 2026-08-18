'use client';

import { useCallback, useMemo } from 'react';
import { useMe } from '@/hooks/queries/useMe';
import { canAccessRoute, getEffectiveHomePage } from '@/lib/constants/permissions';
import { isSuperRole } from '@/lib/constants/roles';
import { getRequiredFeatures } from '@/lib/constants/features';
import type { UserRole } from '@/types/roles';

/**
 * The one hook components use to ask "may I show this?".
 *
 * These are UI guards, not the security boundary. Every answer here is also
 * enforced server-side by the route's own role check and by RLS — hiding a
 * button never protects data.
 */
export function usePermissions() {
  const { data, isPending, error } = useMe();

  const role: UserRole | null = data?.user.role ?? null;
  const features = useMemo(() => new Set(data?.features ?? []), [data?.features]);

  const isFeatureEnabled = useCallback(
    (key: string) => features.has(key),
    [features]
  );

  /** Every module this route needs is enabled. Ungated routes pass. */
  const isRouteFeatureEnabled = useCallback(
    (pathname: string) => {
      const required = getRequiredFeatures(pathname);
      if (!required) return true;
      return required.every((key) => features.has(key));
    },
    [features]
  );

  const hasRole = useCallback(
    (...roles: UserRole[]) => !!role && roles.includes(role),
    [role]
  );

  return {
    user: data?.user ?? null,
    tenant: data?.tenant ?? null,
    role,
    /** null role = signed up, awaiting an admin's approval. */
    isPendingApproval: !isPending && !error && role === null,
    isAdmin: isSuperRole(role),
    /**
     * Platform operator, not tenant admin — may reach the registry console.
     * Decided server-side from PLATFORM_OPERATOR_EMAILS; see lib/auth/platform.ts.
     */
    isPlatformOperator: data?.user.isPlatformOperator ?? false,
    isLoading: isPending,
    error,

    hasRole,
    isFeatureEnabled,
    isRouteFeatureEnabled,
    canAccessRoute: useCallback(
      (pathname: string) => canAccessRoute(pathname, role) && isRouteFeatureEnabled(pathname),
      [role, isRouteFeatureEnabled]
    ),
    getHomePage: useCallback(
      () => getEffectiveHomePage(role, isFeatureEnabled),
      [role, isFeatureEnabled]
    ),
  };
}
