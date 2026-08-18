import { NextResponse, type NextRequest } from 'next/server';
import { badRequest, serverError } from '@/lib/api/auth';
import { requireOperatorAccess } from '@/lib/auth/platform';
import { createTenant, listTenants } from '@/lib/supabase/master-client';
import { toTenantPublic, type TenantPublic } from '@/lib/tenant/serialize';
import type { TenantListItem, TenantPlan } from '@/types/tenant.types';

/**
 * The tenant registry, for the admin console.
 *
 * Every response here is typed `TenantPublic`, never `Tenant` — that is what
 * structurally prevents a Supabase key from being serialised to a browser.
 */

export interface TenantsListResponse {
  tenants: TenantListItem[];
}

export async function GET() {
  const denied = await requireOperatorAccess();
  if (denied) return denied;

  try {
    const tenants = await listTenants();
    const response: TenantsListResponse = { tenants };
    return NextResponse.json(response);
  } catch (error) {
    console.error('[api/admin/tenants] list failed:', error);
    return serverError('טעינת הטננטים נכשלה');
  }
}

/**
 * Registers a Supabase project you created by hand.
 *
 * The other path — POST /api/admin/tenants/create-automated — provisions the
 * project too. This one exists for when the Supabase org has no free slot, or
 * when a project already exists.
 */
export async function POST(request: NextRequest) {
  const denied = await requireOperatorAccess();
  if (denied) return denied;

  let body: {
    subdomain?: string;
    name?: string;
    name_he?: string;
    supabase_project_ref?: string;
    supabase_url?: string;
    supabase_anon_key?: string;
    supabase_service_role_key?: string;
    plan_type?: TenantPlan;
  };

  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  const required = [
    'subdomain',
    'name',
    'supabase_project_ref',
    'supabase_url',
    'supabase_anon_key',
  ] as const;

  for (const field of required) {
    if (!body[field]) return badRequest(`שדה חובה חסר: ${field}`);
  }

  try {
    const tenant = await createTenant({
      subdomain: body.subdomain!.trim().toLowerCase(),
      name: body.name!.trim(),
      name_he: body.name_he?.trim() || null,
      supabase_project_ref: body.supabase_project_ref!.trim(),
      supabase_url: body.supabase_url!.trim(),
      supabase_anon_key: body.supabase_anon_key!.trim(),
      supabase_service_role_key: body.supabase_service_role_key?.trim() ?? '',
      plan_type: body.plan_type,
    });

    const response: { tenant: TenantPublic } = { tenant: toTenantPublic(tenant) };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'יצירת הטננט נכשלה';
    console.error('[api/admin/tenants] create failed:', message);
    return badRequest(message);
  }
}
