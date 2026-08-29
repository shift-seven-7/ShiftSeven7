import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  badRequest,
  getAuthInfo,
  getTenantInfo,
  notFound,
  requireApproved,
  requireRoles,
  serverError,
} from '@/lib/api/auth';
import { TENANT_ADMIN_ROLES } from '@/lib/constants/roles';
import { getTenantById, updateTenant } from '@/lib/supabase/master-client';
import { invalidateTenantCache } from '@/lib/tenant/cache';
import { isLocalTenant } from '@/lib/tenant/local';
import { ALL_FEATURE_KEYS, resolveFeatureSet } from '@/lib/constants/features';
import type { TenantSettings } from '@/types/tenant.types';

/**
 * The CURRENT tenant's own settings — logo, enabled modules, legal copy.
 *
 * Read by any approved user (the shell needs the logo); written by ADMIN only.
 * Always hits the registry directly rather than a cache, so a save is visible
 * on the next request.
 */

export interface TenantSettingsResponse {
  settings: TenantSettings;
  name: string;
  subdomain: string;
}

export async function GET() {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const { tenantId, subdomain } = await getTenantInfo();
  if (isLocalTenant(tenantId)) {
    return NextResponse.json({ settings: {}, name: subdomain, subdomain });
  }

  const tenant = await getTenantById(tenantId);
  if (!tenant) return notFound('הטננט לא נמצא');

  const response: TenantSettingsResponse = {
    settings: tenant.settings,
    name: tenant.name_he || tenant.name,
    subdomain: tenant.subdomain,
  };
  return NextResponse.json(response);
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireRoles(auth, TENANT_ADMIN_ROLES);
  if (denied) return denied;

  const { tenantId } = await getTenantInfo();
  if (isLocalTenant(tenantId)) {
    return badRequest('לא ניתן לערוך הגדרות טננט במצב פיתוח מקומי');
  }

  let body: Partial<TenantSettings> & { targetTenantId?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  // An admin can edit another tenant's settings from the registry console.
  const targetId = body.targetTenantId || tenantId;

  const tenant = await getTenantById(targetId);
  if (!tenant) return notFound('הטננט לא נמצא');

  // Merged, not replaced: the settings screens each own a slice of this object
  // and must not clobber each other's fields.
  const settings: TenantSettings = { ...tenant.settings };

  if ('logo_url' in body) settings.logo_url = body.logo_url || undefined;
  if ('primary_color' in body) settings.primary_color = body.primary_color || undefined;

  if ('features' in body) {
    if (body.features === null || body.features === undefined) {
      // Absent means "everything in the registry" — that is how a tenant keeps
      // getting new modules without anyone editing its row.
      delete settings.features;
    } else if (!Array.isArray(body.features)) {
      return badRequest('רשימת המודולים אינה תקינה');
    } else {
      const known = body.features.filter((key) =>
        (ALL_FEATURE_KEYS as string[]).includes(key)
      );
      settings.features = resolveFeatureSet(known) ?? [];
    }
  }

  if ('terms_of_service' in body || 'privacy_policy' in body) {
    if ('terms_of_service' in body) settings.terms_of_service = body.terms_of_service;
    if ('privacy_policy' in body) settings.privacy_policy = body.privacy_policy;
    // Re-stamping the version is what makes existing users re-accept.
    settings.terms_version = new Date().toISOString().slice(0, 10);
  }

  try {
    const updated = await updateTenant(targetId, { settings });
    invalidateTenantCache(updated.subdomain);

    const response: TenantSettingsResponse = {
      settings: updated.settings,
      name: updated.name_he || updated.name,
      subdomain: updated.subdomain,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('[api/tenant/settings] update failed:', error);
    return serverError('שמירת ההגדרות נכשלה');
  }
}
