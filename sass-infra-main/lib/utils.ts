import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { isAllowedOrigin } from '@/lib/constants/domain';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validates that a string parameter is a usable ID (not a Next.js DRP placeholder).
 * Next.js may inject `%%drp:...%%` placeholders during pre-render.
 */
export function isValidId(value: string | undefined | null): value is string {
  if (!value) return false;
  if (value.includes('%%')) return false;
  return true;
}

/**
 * Gets the base URL for the current request — used for auth redirects, where
 * the tenant's own subdomain must be preserved.
 *
 * Priority:
 * 1. Client-provided origin (supports preview deployments and tunnels)
 * 2. Forwarded headers (set by the proxy / Vercel)
 * 3. Request URL origin
 */
export function getBaseUrl(request: Request, clientOrigin?: string): string {
  // A client-supplied origin is only honoured if it passes the allowlist,
  // otherwise this is an open redirect.
  if (clientOrigin && isAllowedOrigin(clientOrigin)) {
    return clientOrigin.replace(/\/$/, '');
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

/**
 * How to refer to a person on screen when there is no name.
 *
 * Which identifier exists depends on the deployment's sign-in method — a
 * phone-OTP account has no email at all — so nothing should render
 * `user.email` directly.
 */
export function identityLabel(
  email: string | null | undefined,
  phone: string | null | undefined
): string {
  return email || phone || '—';
}

/**
 * Normalizes Hebrew/Latin text for client-side fuzzy matching: strips niqqud,
 * replaces punctuation with spaces, collapses whitespace, and lowercases.
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    // Hebrew niqqud / cantillation marks
    .replace(/[֑-ׇ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Sanitizes a search query for safe use in PostgREST .ilike() / .or() filter
 * strings. Escapes the characters that carry meaning in PostgREST filter syntax.
 */
export function sanitizeSearchQuery(query: string): string {
  return query
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/,/g, '\\,')
    .replace(/\./g, '\\.');
}
