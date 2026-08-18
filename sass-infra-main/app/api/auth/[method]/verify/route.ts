import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiLog, badRequest, getTenantInfo, serverError } from '@/lib/api/auth';
import { resolveMethod } from '@/lib/auth/server/registry';
import { AuthMethodError } from '@/lib/auth/types';
import { getBaseUrl } from '@/lib/utils';

/**
 * Second step of a two-step method — `POST /api/auth/<method>/verify`.
 *
 * Only OTP methods implement it. Anything else answers 400, so a client that
 * calls verify on a password method gets a clear refusal rather than a crash.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ method: string }> }
) {
  const { method: methodId } = await params;
  const { tenantId, subdomain } = await getTenantInfo();
  const route = `/api/auth/${methodId}/verify`;

  const resolved = resolveMethod(methodId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: resolved.status });
  }

  const { handler } = resolved.method;
  if (!handler.verify) {
    return badRequest('שיטת התחברות זו אינה דורשת אימות קוד');
  }

  let body: { identifier?: string; code?: string; origin?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  if (!body.identifier || !body.code) {
    return badRequest('נא להזין את הקוד שנשלח');
  }

  try {
    const result = await handler.verify(
      { identifier: body.identifier, code: body.code },
      { supabase: await createClient(), baseUrl: getBaseUrl(request, body.origin) }
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof AuthMethodError) {
      apiLog({
        route,
        method: 'POST',
        status: error.status,
        error: error.message,
        tenantId,
        subdomain,
      });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error(`[${route}] unexpected failure:`, error);
    return serverError('אימות הקוד נכשל. נסה שוב.');
  }
}
