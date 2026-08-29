/**
 * Base-domain resolution.
 *
 * Every place that needs to know "what apex do we serve tenants under" reads it
 * from here — never from a string literal. This is what makes the boilerplate
 * portable between projects: change NEXT_PUBLIC_BASE_DOMAIN and nothing else.
 */

/**
 * Normalises whatever was put in NEXT_PUBLIC_BASE_DOMAIN down to a bare host.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * The variable wants `example.com`. It is extremely natural to paste
 * `https://example.com/` instead, and the raw value used to flow straight into
 * places that concatenate it:
 *
 *   tenantUrl('acme')  →  https://acme.https://example.com/
 *   the new Supabase project's NAME  →  "https://example-acme"
 *   the tenant project's auth Site URL and redirect allow-list
 *
 * None of that failed loudly. It produced a working deployment with a tenant
 * nobody could sign in to and a Supabase project with a nonsense name, and the
 * cause was three files away from the symptom.
 *
 * So: accept the natural mistake, reduce it to what was meant, and say so.
 */
function normaliseBaseDomain(raw: string | undefined): {
  value: string;
  warning: string | null;
} {
  const input = raw?.trim();
  if (!input) return { value: 'localhost', warning: null };

  const host = input
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '') // scheme
    .split('/')[0] // path
    .split('?')[0]
    .split('#')[0]
    .split('@')
    .pop()! // userinfo
    .split(':')[0] // port
    .replace(/\.+$/, ''); // trailing dot

  if (!host || !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(host)) {
    return {
      value: 'localhost',
      warning:
        `NEXT_PUBLIC_BASE_DOMAIN="${input}" is not a usable host name — falling back to ` +
        'localhost. Set it to a bare domain, e.g. example.com',
    };
  }

  return {
    value: host,
    warning:
      host === input.toLowerCase()
        ? null
        : `NEXT_PUBLIC_BASE_DOMAIN="${input}" was read as "${host}". Set it to a bare ` +
          'domain — no scheme, no path, no port.',
  };
}

const normalised = normaliseBaseDomain(process.env.NEXT_PUBLIC_BASE_DOMAIN);

/**
 * The apex domain tenants live under. A tenant with subdomain `acme` is served
 * at `acme.<BASE_DOMAIN>`. Always a bare host — see normaliseBaseDomain.
 */
export const BASE_DOMAIN = normalised.value;

/** Set when the configured value had to be corrected, or was unusable. */
export const BASE_DOMAIN_WARNING = normalised.warning;

if (BASE_DOMAIN_WARNING) console.warn(`[domain] ${BASE_DOMAIN_WARNING}`);

/**
 * Hosts that are the marketing/apex surface rather than a tenant.
 * A request to any of these resolves to "no tenant".
 */
export const RESERVED_SUBDOMAINS = ['www', 'app', 'api', 'admin'] as const;

/** `https://acme.example.app` */
export function tenantUrl(subdomain: string): string {
  return `https://${subdomain}.${BASE_DOMAIN}`;
}

/** True when NEXT_PUBLIC_BASE_DOMAIN was actually configured. */
export const HAS_BASE_DOMAIN = BASE_DOMAIN !== 'localhost';

/**
 * A link to a tenant for the browser to follow.
 *
 * `tenantUrl()` above is the CANONICAL address — always `https://`, no port —
 * and that is correct for the things a machine stores: Supabase redirect
 * allow-lists, DNS records, emailed links.
 *
 * It is the wrong thing to put in an `href`, for two reasons that both bite
 * before a deployment has its domain:
 *
 *   · on `localhost:3000` it yields `https://acme.localhost` — right host,
 *     wrong scheme, no port, so the browser reaches nothing
 *   · on a `*.vercel.app` deployment the subdomain does not exist at all, and
 *     it cannot: wildcard subdomains of vercel.app are not yours
 *
 * So: when the page is already served from under BASE_DOMAIN, link to the
 * tenant's subdomain, borrowing this page's scheme and port. Otherwise stay on
 * the current origin and name the tenant with `?tenant=`, which proxy.ts
 * honours above every other rule. That keeps the console usable from the moment
 * of the first deploy rather than from the moment DNS propagates.
 */
export function tenantHref(subdomain: string, path = ''): string {
  // Server-side there is no page to borrow from — fall back to canonical.
  if (typeof window === 'undefined') return `${tenantUrl(subdomain)}${path}`;

  const { protocol, host, hostname, port } = window.location;

  const underBaseDomain =
    HAS_BASE_DOMAIN && (hostname === BASE_DOMAIN || hostname.endsWith(`.${BASE_DOMAIN}`));

  if (underBaseDomain) {
    return `${protocol}//${subdomain}.${BASE_DOMAIN}${port ? `:${port}` : ''}${path}`;
  }

  const separator = path.includes('?') ? '&' : '?';
  return `${protocol}//${host}${path}${separator}tenant=${encodeURIComponent(subdomain)}`;
}

/** The OAuth redirect target registered on each tenant's Supabase project. */
export function tenantAuthCallbackUrl(subdomain: string): string {
  return `${tenantUrl(subdomain)}/auth/callback`;
}

/**
 * Pulls the tenant subdomain out of a Host header.
 *
 * Suffix-matches against BASE_DOMAIN rather than counting dots, so multi-label
 * apexes (`example.co.il`) work. Returns null for the apex itself, for reserved
 * subdomains, and for anything not under BASE_DOMAIN.
 */
export function extractSubdomainFromHost(host: string): string | null {
  const hostname = host.split(':')[0].toLowerCase();

  if (hostname === BASE_DOMAIN) return null;

  const suffix = `.${BASE_DOMAIN}`;
  if (!hostname.endsWith(suffix)) return null;

  const label = hostname.slice(0, -suffix.length);
  // Only a single label is a tenant — `a.b.example.app` is not.
  if (!label || label.includes('.')) return null;
  if ((RESERVED_SUBDOMAINS as readonly string[]).includes(label)) return null;

  return label;
}

/**
 * Guards auth redirects against open-redirect abuse: an origin is trusted only
 * if it is localhost, the base domain (or a subdomain of it), or a Vercel
 * preview host.
 */
export function isAllowedOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    if (hostname.endsWith('.localhost')) return true;
    if (hostname === BASE_DOMAIN || hostname.endsWith(`.${BASE_DOMAIN}`)) return true;
    if (hostname.endsWith('.vercel.app')) return true;
    return false;
  } catch {
    return false;
  }
}
