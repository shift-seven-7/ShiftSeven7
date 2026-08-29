import { NextResponse, type NextRequest } from 'next/server';
import { getActiveTenants } from '@/lib/supabase/master-client';
import { createServiceClientForTenant } from '@/lib/supabase/service';
import { sendShift7Email } from '@/lib/shift7/email';
import type { Shift7CredentialKey } from '@/types/database.types';

/**
 * Daily credential-expiry check, direct port of the original single-tenant
 * app's cron route logic — but this platform is multi-tenant, and Vercel Cron
 * only ever calls ONE url (there's no per-subdomain cron scheduling), so this
 * route itself fans out across every active tenant that has the Shift7
 * module, using getActiveTenants() + createServiceClientForTenant() — both
 * built specifically "for jobs that fan out across tenants" (see their doc
 * comments). Each tenant's data stays in its own service-role client; nothing
 * here ever mixes rows across tenants.
 *
 * Timezone note carried over unchanged from the original: Vercel Cron is
 * UTC-only, so a fixed daily schedule drifts ~1hr across DST — accepted for a
 * daily reminder, not worth DST-aware gating (see docs/MIGRATION_PLAN.md B.5).
 */

const CREDENTIALS = [
  { key: 'weapon_license_expiry' as const, label: 'רישיון נשק' },
  { key: 'weapon_refresh_expiry' as const, label: 'רענון נשק' },
  { key: 'medical_check_expiry' as const, label: 'אישור רפואי' },
];

type Bucket = 'expired' | 'urgent' | null;
type NotificationState = 'none' | 'urgent' | 'expired';

function bucketFor(dateStr: string): Bucket {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T12:00:00');
  const days = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'expired';
  if (days <= 30) return 'urgent';
  return null;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

interface StaffForCheck {
  id: string;
  full_name: string;
  email: string | null;
  weapon_license_expiry: string | null;
  weapon_refresh_expiry: string | null;
  medical_check_expiry: string | null;
}

async function checkTenant(tenantId: string): Promise<{ sent: number; totalStaff: number }> {
  const supabase = await createServiceClientForTenant(tenantId);

  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('id, full_name, email, weapon_license_expiry, weapon_refresh_expiry, medical_check_expiry')
    .not('email', 'is', null);
  if (staffError) throw new Error(staffError.message);

  const { data: existingStates } = await supabase
    .from('staff_credential_notification_state')
    .select('*');
  const stateMap = new Map<string, NotificationState>();
  (existingStates ?? []).forEach((row) =>
    stateMap.set(`${row.staff_id}::${row.credential_key}`, row.state as NotificationState)
  );

  let sentCount = 0;

  for (const member of (staff ?? []) as StaffForCheck[]) {
    const toNotify: { label: string; status: string; date: string }[] = [];
    const upserts: { staff_id: string; credential_key: Shift7CredentialKey; state: NotificationState }[] = [];

    for (const cred of CREDENTIALS) {
      const dateVal = member[cred.key];
      if (!dateVal) continue;

      const bucket = bucketFor(dateVal);
      const prev = stateMap.get(`${member.id}::${cred.key}`) ?? 'none';

      if (bucket === 'expired' && prev !== 'expired') {
        toNotify.push({ label: cred.label, status: 'פג תוקף', date: fmtDate(dateVal) });
        upserts.push({ staff_id: member.id, credential_key: cred.key, state: 'expired' });
      } else if (bucket === 'urgent' && prev === 'none') {
        const days = Math.round(
          (new Date(dateVal + 'T12:00:00').getTime() -
            new Date(new Date().setHours(0, 0, 0, 0)).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        toNotify.push({ label: cred.label, status: `יפוג בעוד ${days} ימים`, date: fmtDate(dateVal) });
        upserts.push({ staff_id: member.id, credential_key: cred.key, state: 'urgent' });
      } else if (bucket === null && prev !== 'none') {
        upserts.push({ staff_id: member.id, credential_key: cred.key, state: 'none' });
      }
    }

    if (toNotify.length > 0 && member.email) {
      const html = `
        <p>שלום ${member.full_name},</p>
        <p>להלן פירוט אישורים שדורשים טיפול:</p>
        <ul>
          ${toNotify.map((n) => `<li>${n.label} (${n.date}) — ${n.status}</li>`).join('')}
        </ul>
      `;
      try {
        await sendShift7Email({
          to: member.email,
          subject: 'תזכורת: תוקף אישורים שדורש טיפול',
          html,
        });
        sentCount += 1;
      } catch {
        // Best-effort per staff member — one failed send shouldn't stop the run.
      }
    }

    for (const upsert of upserts) {
      await supabase
        .from('staff_credential_notification_state')
        .upsert(upsert, { onConflict: 'staff_id,credential_key' });
    }
  }

  return { sent: sentCount, totalStaff: (staff ?? []).length };
}

/** Layer 1 of the module flag resolution: absent features list = everything. */
function tenantHasShift7(features: string[] | undefined): boolean {
  return !features || features.includes('shift7');
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const tenants = (await getActiveTenants()).filter((tenant) =>
    tenantHasShift7(tenant.settings?.features)
  );

  const results: Record<string, { sent: number; totalStaff: number } | { error: string }> = {};

  for (const tenant of tenants) {
    try {
      results[tenant.subdomain] = await checkTenant(tenant.id);
    } catch (error) {
      // One tenant's failure (e.g. a stale service-role key) must not stop
      // the run for everyone else.
      console.error(`[cron/shift7-check-credential-expiries] tenant ${tenant.subdomain} failed:`, error);
      results[tenant.subdomain] = { error: error instanceof Error ? error.message : 'unknown error' };
    }
  }

  return NextResponse.json({ success: true, tenants_checked: tenants.length, results });
}
