import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
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
 * A genuinely fresh tenant has no facilities either, and facilities' own
 * write RLS also requires is_shift7_admin() — so creating the first facility
 * has the exact same chicken-and-egg problem as the first staff row. POST
 * optionally creates one facility as part of this same bootstrap call, using
 * the SERVICE-ROLE client for the actual writes (both the optional facility
 * insert and the staff insert) once authorization is already established via
 * the session client above — same pattern as the platform's own
 * app/api/users/[id]/route.ts DELETE handler.
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

  const [{ data: existingStaff, error: staffError }, { count: facilityCount, error: facilityError }] =
    await Promise.all([
      supabase.from('staff').select('id').eq('user_id', auth!.userId).maybeSingle(),
      supabase.from('facilities').select('id', { count: 'exact', head: true }),
    ]);

  if (staffError) return serverError('בדיקת סטטוס ההצטרפות נכשלה');

  return NextResponse.json({
    hasStaffRow: !!existingStaff,
    canBootstrap: !existingStaff && isAdmin(auth),
    // Read as "unknown, assume some exist" on error rather than forcing a
    // facility field the caller may not need — the insert below still
    // requires one either way, this only decides which form the UI shows.
    hasAnyFacility: facilityError ? true : (facilityCount ?? 0) > 0,
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

  let body: {
    full_name?: string;
    role?: 'guard' | 'dispatcher';
    primary_facility?: string;
    new_facility_name?: string;
    new_facility_code?: string;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  if (!body.full_name?.trim()) return badRequest('שם מלא הוא שדה חובה');
  if (!body.primary_facility && !(body.new_facility_name?.trim() && body.new_facility_code?.trim())) {
    return badRequest('יש לבחור מתקן קיים או להזין שם וקוד למתקן חדש');
  }

  const service = await createServiceClient();

  let facilityId = body.primary_facility;
  if (!facilityId) {
    const { data: facility, error: facilityError } = await service
      .from('facilities')
      .insert({
        name: body.new_facility_name!.trim(),
        code: body.new_facility_code!.trim(),
        created_by: auth!.userId,
      })
      .select('id')
      .single();

    if (facilityError) {
      if (facilityError.code === '23505') {
        return badRequest(`קוד מתקן "${body.new_facility_code}" כבר קיים`);
      }
      console.error('[api/shift7/bootstrap] facility create failed:', facilityError.message);
      return serverError('יצירת המתקן נכשלה');
    }
    facilityId = facility.id;
  }

  // Auto-assign the next free numeric employee_id, same logic as the regular
  // staff-create route — this row is empty at bootstrap time, but written the
  // same way for consistency.
  const { data: existingIds } = await service.from('staff').select('employee_id');
  let candidate = 1;
  for (const row of existingIds ?? []) {
    const n = parseInt(row.employee_id, 10);
    if (!Number.isNaN(n) && n >= candidate) candidate = n + 1;
  }

  const { data, error } = await service
    .from('staff')
    .insert({
      user_id: auth!.userId,
      full_name: body.full_name.trim(),
      employee_id: String(candidate),
      role: body.role === 'dispatcher' ? 'dispatcher' : 'guard',
      primary_facility: facilityId,
      email: auth!.userEmail ?? null,
      access_level: 'admin',
      created_by: auth!.userId,
    })
    .select()
    .single();

  if (error) {
    console.error('[api/shift7/bootstrap] staff create failed:', error.message);
    return serverError('יצירת רשומת הצוות נכשלה');
  }

  return NextResponse.json({ staffMember: data });
}
