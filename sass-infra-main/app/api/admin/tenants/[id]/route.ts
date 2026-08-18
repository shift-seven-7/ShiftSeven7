import { NextResponse, type NextRequest } from 'next/server';
import {
  badRequest,
  notFound,
  serverError,
} from '@/lib/api/auth';
import { requireOperatorAccess } from '@/lib/auth/platform';
import {
  deleteTenant,
  getTenantById,
  reactivateTenant,
  suspendTenant,
  updateTenant,
} from '@/lib/supabase/master-client';
import { invalidateTenantCache } from '@/lib/tenant/cache';
import { toTenantPublic, type TenantPublic } from '@/lib/tenant/serialize';
import type { TenantPlan, TenantSettings } from '@/types/tenant.types';

const PLAN_TYPES: TenantPlan[] = ['trial', 'standard', 'premium', 'enterprise'];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const denied = await requireOperatorAccess();
  if (denied) return denied;

  try {
    const tenant = await getTenantById(id);
    if (!tenant) return notFound('הטננט לא נמצא');

    // toTenantPublic strips both Supabase keys. The response type makes
    // forgetting it a compile error, not a silent leak.
    const response: { tenant: TenantPublic } = { tenant: toTenantPublic(tenant) };
    return NextResponse.json(response);
  } catch (error) {
    console.error('[api/admin/tenants/:id] read failed:', error);
    return serverError('טעינת הטננט נכשלה');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const denied = await requireOperatorAccess();
  if (denied) return denied;

  let body: {
    action?: 'suspend' | 'reactivate';
    name?: string;
    name_he?: string | null;
    plan_type?: TenantPlan;
    max_users?: number;
    storage_limit_gb?: number;
    settings?: TenantSettings;
    supabase_url?: string;
    /** Write-only. Absent or empty means "leave the stored key alone". */
    supabase_anon_key?: string;
    supabase_service_role_key?: string;
    subdomain?: string;
  };

  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  const existing = await getTenantById(id);
  if (!existing) return notFound('הטננט לא נמצא');

  try {
    let tenant;

    if (body.action === 'suspend') {
      tenant = await suspendTenant(id);
    } else if (body.action === 'reactivate') {
      tenant = await reactivateTenant(id);
    } else {
      // The subdomain is immutable: the encryption AAD is bound to it, and DNS
      // records and OAuth redirect URLs are keyed to it. Changing it would
      // invalidate both stored keys.
      if (body.subdomain && body.subdomain !== existing.subdomain) {
        return badRequest('לא ניתן לשנות את הסאב-דומיין לאחר יצירת הטננט');
      }
      if (body.plan_type && !PLAN_TYPES.includes(body.plan_type)) {
        return badRequest('סוג מנוי לא תקין');
      }

      tenant = await updateTenant(id, {
        name: body.name,
        name_he: body.name_he,
        plan_type: body.plan_type,
        max_users: body.max_users,
        storage_limit_gb: body.storage_limit_gb,
        settings: body.settings,
        supabase_url: body.supabase_url,
        // Empty string is "unchanged", not "clear it" — the edit form sends
        // blank key fields on every save.
        supabase_anon_key: body.supabase_anon_key || undefined,
        supabase_service_role_key: body.supabase_service_role_key || undefined,
      });
    }

    // Status and credentials are cached by the proxy; drop the entry so this
    // instance sees the change immediately. Other instances expire on TTL.
    invalidateTenantCache(tenant.subdomain);

    const response: { tenant: TenantPublic } = { tenant: toTenantPublic(tenant) };
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'עדכון הטננט נכשל';
    console.error('[api/admin/tenants/:id] update failed:', message);
    return serverError(message);
  }
}

/** Soft delete — status becomes 'deleted' and the Supabase project is untouched. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const denied = await requireOperatorAccess();
  if (denied) return denied;

  const existing = await getTenantById(id);
  if (!existing) return notFound('הטננט לא נמצא');

  try {
    await deleteTenant(id);
    invalidateTenantCache(existing.subdomain);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api/admin/tenants/:id] delete failed:', error);
    return serverError('מחיקת הטננט נכשלה');
  }
}
