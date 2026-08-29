import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getTenantConnection, hasMasterConfig } from '@/lib/supabase/master-client';
import { getConnectionWithCache } from '@/lib/tenant/cache';
import { getLocalTenantConnection } from '@/lib/tenant/local';
import { extractSubdomainFromHost } from '@/lib/constants/domain';
import { HOME_PAGES, PENDING_APPROVAL_ROUTE } from '@/lib/constants/permissions';
import { isUserRole } from '@/types/roles';
import type { TenantConnection } from '@/types/tenant.types';

/**
 * Multi-tenant proxy (Next 16's name for what used to be middleware.ts).
 *
 * On every request it:
 *   1. reads the tenant subdomain off the Host header,
 *   2. resolves it against the master registry (cached, connection fields only),
 *   3. injects the tenant's Supabase credentials as request headers,
 *   4. refreshes the Supabase session against that tenant's project,
 *   5. sends anonymous users to the login page.
 *
 * ── WHY SO FEW HEADERS ───────────────────────────────────────────────────────
 * Only four headers are injected. Everything mutable — logo, modules, PDF
 * branding, legal copy — is read fresh from the registry by /api/users/me and
 * /api/tenant/settings instead. That keeps admin changes visible immediately,
 * and keeps request headers small enough that no --max-http-header-size flag
 * is ever needed.
 */

/** The error pages themselves must render even though no tenant resolved. */
const TENANT_ERROR_ROUTES = ['/tenant-not-found', '/tenant-suspended'];

/** Path prefixes an anonymous user may reach on a resolved tenant. */
const PUBLIC_PREFIXES = ['/auth', '/api', '/tenant-'];

function extractSubdomain(request: NextRequest): string | null {
  // Highest priority: an explicit override, for working on a specific tenant
  // from plain localhost.
  const override = request.nextUrl.searchParams.get('tenant');
  if (override) return override;

  const host = (request.headers.get('host') || '').toLowerCase();
  const hostname = host.split(':')[0];

  // acme.localhost:3000 -> "acme"; bare localhost -> the env default.
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return process.env.LOCAL_TENANT_SUBDOMAIN || null;
  }
  if (hostname.endsWith('.localhost')) {
    return hostname.slice(0, -'.localhost'.length) || null;
  }

  // Tunnels (ngrok, cloudflared) carry an unrelated hostname.
  if (hostname.endsWith('.ngrok-free.dev') || hostname.endsWith('.ngrok.io')) {
    return process.env.LOCAL_TENANT_SUBDOMAIN || null;
  }

  // Preview deployments have no tenant subdomain of their own. Opt in
  // explicitly — defaulting to a real tenant would let every preview build
  // read and write production data.
  if (hostname.endsWith('.vercel.app')) {
    return process.env.DEFAULT_PREVIEW_TENANT || null;
  }

  return extractSubdomainFromHost(hostname);
}

async function resolveTenant(subdomain: string | null): Promise<TenantConnection | null> {
  if (!subdomain) return null;

  const local = getLocalTenantConnection(subdomain);
  if (local) return local;

  if (!hasMasterConfig()) {
    warnOnce(
      process.env.USE_LOCAL_DB === 'true'
        ? '[proxy] No registry credentials. Every request will land on /tenant-not-found.\n' +
            '        Run `npm run db:start`, then `npm run db:status` and copy the API URL and\n' +
            '        the two keys into LOCAL_TENANT_SUPABASE_{URL,ANON_KEY,SERVICE_KEY} in\n' +
            '        .env.local. Then `npm run db:init`.'
        : '[proxy] MASTER_SUPABASE_URL / MASTER_SUPABASE_SERVICE_KEY are not set, so no tenant can resolve.'
    );
    return null;
  }

  try {
    return await getConnectionWithCache(subdomain, getTenantConnection);
  } catch (error) {
    // A registry outage must not surface as a blank 500 on every route. But a
    // missing `tenants` table is a setup problem, not an outage — name it,
    // because otherwise it looks identical to "this subdomain doesn't exist".
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('tenants')) {
      warnOnce(
        '[proxy] The `tenants` registry table is missing. Run `npm run db:migrate:master`\n' +
          '        (locally) or `npm run sync-master-migrations` (hosted master).'
      );
    } else {
      console.error('[proxy] tenant lookup failed:', error);
    }
    return null;
  }
}

// The proxy runs on every request; without this the console fills with the same
// setup warning hundreds of times and hides everything else.
const warned = new Set<string>();
function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets, Next internals, the health check, first-run setup and the
  // backoffice never need a tenant.
  //
  // /bootstrap exists precisely for the state where no tenant exists yet, and
  // /backoffice authenticates against the MASTER project rather than a tenant's
  // — so resolving a tenant first would make both unreachable, since every path
  // but `/` rewrites to /tenant-not-found when nothing resolves.
  //
  // Their own guards are in lib/services/bootstrap.ts and lib/auth/platform.ts.
  if (
    pathname.startsWith('/_next') ||
    pathname === '/api/health' ||
    pathname === '/bootstrap' ||
    pathname === '/api/bootstrap' ||
    pathname.startsWith('/backoffice') ||
    pathname.startsWith('/api/backoffice') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const subdomain = extractSubdomain(request);
  const tenant = await resolveTenant(subdomain);

  if (!tenant) {
    if (TENANT_ERROR_ROUTES.includes(pathname)) return NextResponse.next();

    // The registry endpoints serve both consoles. From the backoffice they are
    // called on a host with no tenant, and they authenticate against the master
    // session instead — see requireOperatorAccess(). Rewriting them to
    // /tenant-not-found here would answer an API call with an HTML page.
    if (pathname.startsWith('/api/admin/')) return NextResponse.next();

    // The apex domain legitimately has no tenant — that is the marketing
    // surface. But a request that NAMED a tenant and failed to resolve is an
    // error, and rendering the splash there hides it: you get a generic
    // landing page instead of "this organisation was not found", with nothing
    // pointing at the real cause.
    if (pathname === '/' && !subdomain) return NextResponse.next();

    const url = request.nextUrl.clone();
    url.pathname = '/tenant-not-found';
    return NextResponse.rewrite(url);
  }

  if (tenant.status === 'suspended') {
    const url = request.nextUrl.clone();
    url.pathname = '/tenant-suspended';
    return NextResponse.rewrite(url);
  }

  const requestHeaders = new Headers(request.headers);
  const applyTenantHeaders = (target: Headers) => {
    target.set('x-tenant-id', tenant.id);
    target.set('x-tenant-subdomain', tenant.subdomain);
    target.set('x-supabase-url', tenant.supabase_url);
    target.set('x-supabase-anon-key', tenant.supabase_anon_key);
  };
  applyTenantHeaders(requestHeaders);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const applyTenantCookies = (target: NextResponse) => {
    // Readable by the client so TenantProvider can key its caches per tenant.
    // Neither value is a secret.
    const options = {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60,
      path: '/',
    };
    target.cookies.set('tenant-id', tenant.id, options);
    target.cookies.set('tenant-subdomain', tenant.subdomain, options);
  };
  applyTenantCookies(response);

  // ── session refresh, against the tenant's own Supabase project ─────────────
  const supabase = createServerClient(tenant.supabase_url, tenant.supabase_anon_key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        // Supabase rotated the session, so the response has to be rebuilt —
        // and every header and cookie set above re-applied to the new one.
        response = NextResponse.next({ request: { headers: requestHeaders } });
        applyTenantHeaders(response.headers);
        applyTenantCookies(response);

        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── routing ───────────────────────────────────────────────────────────────
  if (pathname === '/') {
    const url = request.nextUrl.clone();

    if (!user) {
      url.pathname = '/auth/login';
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from('users')
      .select('app_role')
      .eq('id', user.id)
      .maybeSingle();

    // A null role means "awaiting approval" — that is the normal state for a
    // fresh self-signup, not an error.
    url.pathname = isUserRole(profile?.app_role)
      ? HOME_PAGES[profile.app_role]
      : PENDING_APPROVAL_ROUTE;
    return NextResponse.redirect(url);
  }

  if (!user && !PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    // Preserve where they were headed so login can send them back.
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next's static output and image files. API routes are
     * intentionally included — they need the tenant headers, and each one
     * enforces its own authorization.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
