import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  badRequest,
  forbidden,
  getAuthInfo,
  isAdmin,
  requireApproved,
  serverError,
} from '@/lib/api/auth';

/**
 * First-run onboarding: lets a freshly provisioned tenant's platform admin
 * create their OWN staff row (access_level='admin'), which is otherwise
 * impossible — is_shift7_admin() requires an existing staff row, so nothing
 * could ever create the first one without this. Mirrors the RLS bootstrap
 * policy exactly ("shift7 platform admin bootstraps own staff row" in
 * 20260104000000_shift7_baseline.sql); this route exists to give a clear
 * Hebrew error instead of a bare RLS-denied insert, same reasoning as the
 * is_shift7_admin() checks on the other Shift7 routes.
 *
 * The tenant provisioning wizard's own admin_created step (core, not this
 * module) only creates the platform ADMIN/SYSTEM_MANAGER login — it doesn't
 * and shouldn't know Shift7 exists. This is the module's own follow-on step.
 */

export async function GET() {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const { data: existing, error } = await supabase
    .from('staff')
    .select('id')
    .eq('user_id', auth!.userId)
    .maybeSingle();

  if (error) return serverError('בדיקת סטטוס ההצטרפות נכשלה');

  return NextResponse.json({
    hasStaffRow: !!existing,
    canBootstrap: !existing && isAdmin(auth),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;
  if (!isAdmin(auth)) {
    return forbidden('רק מנהל הטננט יכול ליצור את רשומת הצוות הראשונה שלו');
  }

  const { data: existing } = await supabase
    .from('staff')
    .select('id')
    .eq('user_id', auth!.userId)
    .maybeSingle();
  if (existing) return badRequest('כבר קיימת רשומת צוות עבורך');

  let body: { full_name?: string; primary_facility?: string; role?: 'guard' | 'dispatcher' };
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  if (!body.full_name?.trim() || !body.primary_facility) {
    return badRequest('שם מלא ומתקן ראשי הם שדות חובה');
  }

  // Auto-assign the next free numeric employee_id, same logic as the regular
  // staff-create route — this row is empty at bootstrap time, but written the
  // same way for consistency.
  const { data: existingIds } = await supabase.from('staff').select('employee_id');
  let candidate = 1;
  for (const row of existingIds ?? []) {
    const n = parseInt(row.employee_id, 10);
    if (!Number.isNaN(n) && n >= candidate) candidate = n + 1;
  }

  const { data, error } = await supabase
    .from('staff')
    .insert({
      user_id: auth!.userId,
      full_name: body.full_name.trim(),
      employee_id: String(candidate),
      role: body.role === 'dispatcher' ? 'dispatcher' : 'guard',
      primary_facility: body.primary_facility,
      email: auth!.userEmail ?? null,
      access_level: 'admin',
      created_by: auth!.userId,
    })
    .select()
    .single();

  if (error) {
    console.error('[api/shift7/bootstrap] insert failed:', error.message);
    return serverError('יצירת רשומת הצוות נכשלה');
  }

  return NextResponse.json({ staffMember: data });
}
