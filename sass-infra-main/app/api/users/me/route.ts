import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, getAuthInfo, getTenantInfo, serverError, unauthorized } from '@/lib/api/auth';
import { getTenantById } from '@/lib/supabase/master-client';
import { isPlatformOperator } from '@/lib/auth/platform';
import { isSuperRole } from '@/lib/constants/roles';
import { ALL_FEATURE_KEYS, resolveFeatureSet } from '@/lib/constants/features';
import { isLocalTenant } from '@/lib/tenant/local';
import type { UserRole } from '@/types/roles';

/**
 * The single endpoint the client bootstraps from: who am I, what role do I
 * hold, which modules can I see, and what does this tenant look like.
 *
 * Everything mutable about the tenant is read HERE, fresh from the registry,
 * rather than injected into request headers by the proxy. That is what makes an
 * admin's change to the logo or the module set visible on the next page load
 * instead of after a cache TTL.
 */

export interface MeResponse {
  user: {
    id: string;
    email: string | undefined;
    fullName: string | null;
    phone: string | null;
    avatarUrl: string | null;
    role: UserRole | null;
    isActive: boolean;
    themeMode: string | null;
    themeColor: string | null;
    /**
     * May reach the tenant registry console. Separate from the role: the
     * allow-list lives in the deployment's env, so the browser cannot work it
     * out and has to be told. UI only — /api/admin/tenants/** checks again.
     */
    isPlatformOperator: boolean;
  };
  tenant: {
    id: string;
    subdomain: string;
    name: string;
    logoUrl: string | null;
    termsVersion: string | null;
  };
  /** Module keys this user may see, after all three resolution layers. */
  features: string[];
}

export async function GET() {
  const supabase = await createClient();
  const { tenantId, subdomain } = await getTenantInfo();

  // allowInactive so a deactivated user gets a specific answer the client can
  // act on (sign out + explain) rather than a bare 401.
  const auth = await getAuthInfo(supabase, { allowInactive: true });
  if (!auth) return unauthorized();

  if (!auth.isActive) {
    return NextResponse.json(
      { error: 'החשבון שלך הושבת', code: 'ACCOUNT_DISABLED' },
      { status: 403 }
    );
  }

  const { data: profile } = await supabase
    .from('users')
    .select(
      'id, email, full_name, phone, avatar_url, app_role, is_active, theme_mode, theme_color, features_override'
    )
    .eq('id', auth.userId)
    .maybeSingle();

  // ── module resolution ──────────────────────────────────────────────────────
  // Layer 1: the package the tenant bought (master registry).
  const tenant = isLocalTenant(tenantId) ? null : await getTenantById(tenantId);
  const packageFeatures = resolveFeatureSet(tenant?.settings.features ?? null);

  // null means "no explicit package" — the whole registry.
  let features = packageFeatures ?? [...ALL_FEATURE_KEYS];

  if (!isSuperRole(auth.userRole)) {
    // Layer 2: what the tenant's own admin left switched on.
    const { data: defaults } = await supabase
      .from('tenant_feature_defaults')
      .select('feature_key, enabled');

    const disabledByTenant = new Set(
      (defaults ?? []).filter((row) => !row.enabled).map((row) => row.feature_key)
    );
    features = features.filter((key) => !disabledByTenant.has(key));

    // Layer 3: per-user override. Can only take away, never grant something
    // outside the package.
    const overrides = profile?.features_override ?? {};
    features = features.filter((key) => overrides[key] !== false);
  }

  const response: MeResponse = {
    user: {
      id: auth.userId,
      email: auth.userEmail,
      fullName: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      role: auth.userRole,
      isActive: auth.isActive,
      themeMode: profile?.theme_mode ?? null,
      themeColor: profile?.theme_color ?? null,
      isPlatformOperator: isPlatformOperator(auth.userEmail),
    },
    tenant: {
      id: tenantId,
      subdomain,
      name: tenant?.name_he || tenant?.name || subdomain,
      logoUrl: tenant?.settings.logo_url ?? null,
      termsVersion: tenant?.settings.terms_version ?? null,
    },
    features,
  };

  return NextResponse.json(response);
}

/**
 * Self-service profile edit.
 *
 * Separate from PATCH /api/users/[id], which is admin-only. Keeping them apart
 * means the admin route never has to reason about "unless it's yourself", and
 * this route can never touch a role or an active flag — the fields that decide
 * what someone is allowed to do are simply not reachable here.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);
  if (!auth) return unauthorized();

  let body: { full_name?: unknown; phone?: unknown; avatar_url?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  const patch: { full_name?: string | null; phone?: string | null; avatar_url?: string | null } =
    {};

  if ('full_name' in body) {
    patch.full_name = typeof body.full_name === 'string' ? body.full_name.trim() || null : null;
  }
  if ('phone' in body) {
    patch.phone = typeof body.phone === 'string' ? body.phone.trim() || null : null;
  }
  if ('avatar_url' in body) {
    patch.avatar_url = typeof body.avatar_url === 'string' ? body.avatar_url : null;
  }

  if (Object.keys(patch).length === 0) return badRequest('אין שדות לעדכון');

  const { error } = await supabase.from('users').update(patch).eq('id', auth.userId);

  if (error) {
    console.error('[api/users/me] update failed:', error.message);
    return serverError('עדכון הפרופיל נכשל');
  }

  return NextResponse.json({ success: true });
}
