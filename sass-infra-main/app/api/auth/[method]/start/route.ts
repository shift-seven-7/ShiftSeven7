import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiLog, badRequest, getTenantInfo, serverError } from '@/lib/api/auth';
import { resolveMethod } from '@/lib/auth/server/registry';
import { AuthMethodError, type AuthStartInput } from '@/lib/auth/types';
import { getBaseUrl } from '@/lib/utils';

/**
 * Entry point for every sign-in method — `POST /api/auth/<method>/start`.
 *
 * What "start" means depends on the method: for password it is the whole
 * sign-in, for OAuth it returns a provider URL to navigate to, for OTP it
 * sends a code and the client follows up with .../verify.
 *
 * The route itself knows nothing about any specific method. It resolves the id
 * against the registry, hands over the input, and translates the result. That
 * is the point — adding a method never touches this file.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ method: string }> }
) {
  const { method: methodId } = await params;
  const { tenantId, subdomain } = await getTenantInfo();
  const route = `/api/auth/${methodId}/start`;

  const resolved = resolveMethod(methodId);
  if (!resolved.ok) {
    apiLog({
      route,
      method: 'POST',
      status: resolved.status,
      error: resolved.message,
      tenantId,
      subdomain,
    });
    return NextResponse.json({ error: resolved.message }, { status: resolved.status });
  }

  const { descriptor, handler } = resolved.method;

  let body: Partial<AuthStartInput>;
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  const mode = body.mode === 'sign-up' ? 'sign-up' : 'sign-in';
  if (mode === 'sign-up' && !descriptor.supportsSignUp) {
    return badRequest('הרשמה עצמית אינה זמינה בשיטה זו');
  }

  try {
    const result = await handler.start(
      {
        identifier: body.identifier,
        password: body.password,
        fullName: body.fullName,
        origin: body.origin,
        next: body.next,
        mode,
      },
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
        // Only ever the identifier the caller already knows, and only for
        // email — a phone number in a log line is worse than useless.
        userEmail: descriptor.identifier === 'email' ? body.identifier : undefined,
        tenantId,
        subdomain,
      });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error(`[${route}] unexpected failure:`, error);
    return serverError('ההתחברות נכשלה. נסה שוב.');
  }
}
