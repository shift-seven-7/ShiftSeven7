import { sendEmail } from "@/lib/email";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Direct port of base44/functions/checkCredentialExpiries/entry.ts, run daily
// by Vercel Cron (see vercel.json) instead of a Base44 scheduled workflow.
// See docs/MIGRATION_PLAN.md B.5 for the timezone caveat (Vercel Cron is
// UTC-only, so this drifts ~1hr across DST - accepted for a daily reminder).

const CREDENTIALS = [
  { key: "weapon_license_expiry" as const, label: "רישיון נשק" },
  { key: "weapon_refresh_expiry" as const, label: "רענון נשק" },
  { key: "medical_check_expiry" as const, label: "אישור רפואי" },
];

type Bucket = "expired" | "urgent" | null;
type State = "none" | "urgent" | "expired";

function bucketFor(dateStr: string): Bucket {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T12:00:00");
  const days = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "expired";
  if (days <= 30) return "urgent";
  return null;
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createServiceRoleClient();

  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select("id, full_name, email, weapon_license_expiry, weapon_refresh_expiry, medical_check_expiry")
    .not("email", "is", null);
  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 });

  const { data: existingStates } = await supabase.from("staff_credential_notification_state").select("*");
  const stateMap = new Map<string, State>();
  (existingStates || []).forEach((s) => stateMap.set(`${s.staff_id}::${s.credential_key}`, s.state as State));

  let sentCount = 0;

  for (const s of staff || []) {
    const toNotify: { label: string; status: string; date: string }[] = [];
    const upserts: { staff_id: string; credential_key: string; state: State }[] = [];

    for (const cred of CREDENTIALS) {
      const dateVal = s[cred.key];
      if (!dateVal) continue;

      const bucket = bucketFor(dateVal);
      const prev = stateMap.get(`${s.id}::${cred.key}`) || "none";

      if (bucket === "expired" && prev !== "expired") {
        toNotify.push({ label: cred.label, status: "פג תוקף", date: fmtDate(dateVal) });
        upserts.push({ staff_id: s.id, credential_key: cred.key, state: "expired" });
      } else if (bucket === "urgent" && prev === "none") {
        const days = Math.round(
          (new Date(dateVal + "T12:00:00").getTime() - new Date(new Date().setHours(0, 0, 0, 0)).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        toNotify.push({ label: cred.label, status: `יפוג בעוד ${days} ימים`, date: fmtDate(dateVal) });
        upserts.push({ staff_id: s.id, credential_key: cred.key, state: "urgent" });
      } else if (bucket === null && prev !== "none") {
        upserts.push({ staff_id: s.id, credential_key: cred.key, state: "none" });
      }
    }

    if (toNotify.length > 0 && s.email) {
      const body = `
        <p>שלום ${s.full_name},</p>
        <p>להלן פירוט אישורים שדורשים טיפול:</p>
        <ul>
          ${toNotify.map((n) => `<li>${n.label} (${n.date}) — ${n.status}</li>`).join("")}
        </ul>
      `;
      try {
        await sendEmail({ to: s.email, subject: "תזכורת: תוקף אישורים שדורש טיפול", html: body });
        sentCount += 1;
      } catch {
        // Best-effort per staff - one failed send shouldn't stop the run.
      }
    }

    for (const u of upserts) {
      await supabase
        .from("staff_credential_notification_state")
        .upsert(u, { onConflict: "staff_id,credential_key" });
    }
  }

  return NextResponse.json({ success: true, sent: sentCount, total_staff: (staff || []).length });
}
