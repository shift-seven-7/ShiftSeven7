'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './keys';
import type { MeResponse } from '@/app/api/users/me/route';

/**
 * The bootstrap query. Everything the shell needs — identity, role, tenant
 * branding, visible modules — in one request.
 *
 * Prefer `usePermissions()` in components; it wraps this with the predicates
 * you actually want to call.
 */

export class AccountDisabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountDisabledError';
  }
}

async function fetchMe(): Promise<MeResponse> {
  const response = await fetch('/api/users/me');
  const json = await response.json();

  if (response.status === 403 && json.code === 'ACCOUNT_DISABLED') {
    throw new AccountDisabledError(json.error);
  }
  if (!response.ok) {
    throw new Error(json.error || 'טעינת פרטי המשתמש נכשלה');
  }

  return json as MeResponse;
}

export function useMe() {
  return useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: fetchMe,
    // Role and module changes should surface without a hard refresh, but this
    // is on the critical path of every page — a short window, not zero.
    staleTime: 5 * 60 * 1000,
    // Retrying a 401 just delays the redirect to login.
    retry: false,
  });
}
