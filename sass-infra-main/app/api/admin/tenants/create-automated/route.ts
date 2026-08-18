import { NextResponse, type NextRequest } from 'next/server';
import { badRequest } from '@/lib/api/auth';
import { requireOperatorAccess } from '@/lib/auth/platform';
import { provisionTenant, type AutomationResult } from '@/lib/services/tenant-automation';
import type { TenantPlan } from '@/types/tenant.types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/**
 * Full tenant provisioning in one call.
 *
 * Long-running by nature — creating a Supabase project and waiting for it to
 * come up takes minutes. A partial failure is reported step by step; the setup
 * wizard then re-runs whichever step failed.
 */
export async function POST(request: NextRequest) {
  const denied = await requireOperatorAccess();
  if (denied) return denied;

  let body: {
    subdomain?: string;
    name?: string;
    region?: string;
    plan_type?: TenantPlan;
    adminEmail?: string;
    existingProjectRef?: string;
  };

  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  const subdomain = body.subdomain?.trim().toLowerCase();
  const name = body.name?.trim();

  if (!subdomain || !SUBDOMAIN_RE.test(subdomain)) {
    return badRequest('סאב-דומיין לא תקין');
  }
  if (!name) return badRequest('נא להזין שם ארגון');
  if (body.adminEmail && !EMAIL_RE.test(body.adminEmail)) {
    return badRequest('כתובת אימייל לא תקינה');
  }

  try {
    const result: AutomationResult = await provisionTenant({
      subdomain,
      name,
      region: body.region,
      plan: body.plan_type,
      adminEmail: body.adminEmail,
      existingProjectRef: body.existingProjectRef?.trim() || undefined,
    });

    // A partial run is still a useful answer — 207 so the client renders the
    // per-step outcome instead of a generic failure.
    return NextResponse.json(result, { status: result.completed ? 201 : 207 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'הקמת הטננט נכשלה';
    console.error('[api/admin/tenants/create-automated] failed:', message);
    return badRequest(message);
  }
}
