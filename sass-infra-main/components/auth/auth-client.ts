'use client';

import type { AuthResult } from '@/lib/auth/types';

/**
 * The browser half of the auth registry: one place that knows how to call
 * /api/auth/<method>/* and what to do with each outcome.
 *
 * Kept out of the components so that adding a method means adding a form, not
 * re-deriving the navigation rules.
 */

export async function postAuth(
  path: string,
  body: Record<string, unknown>
): Promise<AuthResult> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin: window.location.origin, ...body }),
  });

  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'ההתחברות נכשלה');

  return json as AuthResult;
}

/**
 * Acts on the outcomes that leave the page, and reports back the ones that
 * keep the user here so the caller can render the next step.
 *
 * Both navigations are full page loads, not router.push: the proxy has to see
 * the new session cookies to work out where this user lands.
 */
export function completeAuth(result: AuthResult, next?: string): 'navigating' | 'stay' {
  switch (result.outcome) {
    case 'session':
      window.location.href = next?.startsWith('/') ? next : '/';
      return 'navigating';
    case 'redirect':
      window.location.href = result.url;
      return 'navigating';
    default:
      return 'stay';
  }
}
