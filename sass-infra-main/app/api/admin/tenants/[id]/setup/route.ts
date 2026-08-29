import { NextResponse, type NextRequest } from 'next/server';
import { notFound, serverError } from '@/lib/api/auth';
import { requireOperatorAccess } from '@/lib/auth/platform';
import { getTenantById } from '@/lib/supabase/master-client';
import { TENANT_SETUP_STEPS, type TenantSetupStep } from '@/types/tenant.types';

/** Provisioning progress for one tenant. */

export interface SetupStatusResponse {
  steps: Array<{ step: TenantSetupStep; done: boolean }>;
  lastError: string | null;
  adminEmail: string | null;
  projectRef: string;
  subdomain: string;
}

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

    const recorded = tenant.setup_status?.steps ?? {};

    const response: SetupStatusResponse = {
      steps: TENANT_SETUP_STEPS.map((step) => ({ step, done: !!recorded[step] })),
      lastError: tenant.setup_status?.last_error ?? null,
      adminEmail: tenant.setup_status?.admin_email ?? null,
      projectRef: tenant.supabase_project_ref,
      subdomain: tenant.subdomain,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[api/admin/tenants/:id/setup] read failed:', error);
    return serverError('טעינת סטטוס ההקמה נכשלה');
  }
}
