import { NextResponse, type NextRequest } from 'next/server';
import { badRequest, forbidden, notFound, serverError } from '@/lib/api/auth';
import {
  getBootstrapAvailability,
  isBootstrapTokenValid,
  type BootstrapAvailability,
} from '@/lib/services/bootstrap';
import { provisionTenant, type AutomationResult } from '@/lib/services/tenant-automation';
import type { TenantPlan } from '@/types/tenant.types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/**
 * First-run provisioning, without an account.
 *
 * The only endpoint in the app that runs privileged work for an unauthenticated
 * caller — because at this point there is no tenant to hold an account. See
 * lib/services/bootstrap.ts for the two conditions that gate it.
 *
 * Everything after the gate is the same `provisionTenant` the console and the
 * CLI call, so there is no third implementation of the eight steps.
 */

/** Whether the setup screen should render, and why not. */
export async function GET() {
  try {
    const availability: BootstrapAvailability = await getBootstrapAvailability();
    return NextResponse.json(availability);
  } catch (error) {
    console.error('[api/bootstrap] availability check failed:', error);
    // Unreachable registry is a setup problem of its own — say so rather than
    // reporting the route as merely unavailable.
    return serverError('לא ניתן לקרוא את מאגר הטננטים. בדוק את משתני MASTER_SUPABASE_*.');
  }
}

export async function POST(request: NextRequest) {
  const availability = await getBootstrapAvailability();

  if (!availability.available) {
    // A disabled route answers 404, not 403: a deployment that never opted in
    // should not confirm that first-run provisioning exists.
    return availability.reason === 'disabled'
      ? notFound()
      : forbidden('כבר קיים טננט. ההקמה הראשונית סגורה.');
  }

  let body: {
    token?: string;
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

  if (!isBootstrapTokenValid(body.token)) {
    console.warn('[api/bootstrap] rejected: bad token');
    return forbidden('קוד ההקמה שגוי');
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
    console.error('[api/bootstrap] provisioning failed:', message);
    return badRequest(message);
  }
}
