import { NextResponse, type NextRequest } from 'next/server';
import { badRequest, notFound } from '@/lib/api/auth';
import { requireOperatorAccess } from '@/lib/auth/platform';
import { getTenantById } from '@/lib/supabase/master-client';
import { recordStep, runStep } from '@/lib/services/tenant-setup-steps';
import { TENANT_SETUP_STEPS, type TenantSetupStep } from '@/types/tenant.types';

/**
 * Re-runs one provisioning step.
 *
 * This is what makes a failed setup recoverable: the operator fixes whatever
 * blocked the step (a missing env var, a Supabase outage) and retries just
 * that step, instead of tearing down a real project and starting over.
 *
 * Every step is idempotent, so re-running a step that already succeeded is
 * harmless.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const denied = await requireOperatorAccess();
  if (denied) return denied;

  let body: { step?: string; adminEmail?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  const step = body.step as TenantSetupStep | undefined;
  if (!step || !TENANT_SETUP_STEPS.includes(step)) {
    return badRequest('שלב לא מוכר');
  }

  const tenant = await getTenantById(id);
  if (!tenant) return notFound('הטננט לא נמצא');

  try {
    const result = await runStep(step, {
      tenantId: tenant.id,
      subdomain: tenant.subdomain,
      name: tenant.name,
      projectRef: tenant.supabase_project_ref,
      plan: tenant.plan_type,
      adminEmail: body.adminEmail ?? tenant.setup_status?.admin_email,
    });

    await recordStep(tenant.id, step, true);
    return NextResponse.json({ ok: true, message: result.message });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'הרצת השלב נכשלה';
    await recordStep(tenant.id, step, false, message);
    console.error(`[api/admin/tenants/:id/setup/run-step] ${step} failed:`, message);

    // 200 with ok:false — the request itself succeeded, the step did not. The
    // wizard renders the message next to the step.
    return NextResponse.json({ ok: false, message });
  }
}
