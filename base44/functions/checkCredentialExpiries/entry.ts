import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const CREDENTIALS = [
  { key: "weapon_license_expiry", label: "רישיון נשק" },
  { key: "weapon_refresh_expiry", label: "רענון נשק" },
  { key: "medical_check_expiry", label: "אישור רפואי" },
];

function fmtDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear();
}

function bucketFor(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T12:00:00");
  const days = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { bucket: "expired", days };
  if (days <= 30) return { bucket: "urgent", days };
  return { bucket: null, days };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const staff = await base44.asServiceRole.entities.Staff.list();
    let sentCount = 0;

    for (const s of staff) {
      if (!s.email) continue;

      const notified = {};
      (s.expiry_notified || "").split(",").filter(Boolean).forEach((p) => {
        const idx = p.indexOf(":");
        notified[p.slice(0, idx)] = p.slice(idx + 1);
      });

      const toNotify = [];
      const newState = { ...notified };

      for (const c of CREDENTIALS) {
        const date = s[c.key];
        if (!date) continue;
        const { bucket, days } = bucketFor(date);
        const prev = notified[c.key] || "none";

        if (bucket === "expired" && prev !== "expired") {
          toNotify.push({ label: c.label, date, status: "פג תוקף" });
          newState[c.key] = "expired";
        } else if (bucket === "urgent" && prev === "none") {
          toNotify.push({ label: c.label, date, status: "יפוג בעוד " + days + " ימים" });
          newState[c.key] = "urgent";
        } else if (bucket === null && prev !== "none") {
          newState[c.key] = "none";
        }
      }

      if (toNotify.length > 0) {
        const lines = toNotify.map(
          (t) => "• " + t.label + " — " + t.status + " (תאריך תוקף: " + fmtDate(t.date) + ")"
        );
        const body =
          "שלום " + s.full_name + ",\n\n" +
          "זוהי תזכורת אוטומטית ממערכת SecureShift על תוקפים שדורשים טיפול:\n\n" +
          lines.join("\n") + "\n\n" +
          "אנא פנה למנהל המערכת בהקדם לחידוש האישורים.\n\n" +
          "בברכה,\nמערכת SecureShift";
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: s.email,
            subject: "תזכורת: תוקף אישורים שדורש טיפול",
            body,
          });
          sentCount++;
        } catch (e) {
          // email failed (e.g. user not registered) — continue
        }
      }

      const stateStr = Object.entries(newState)
        .map(([k, v]) => k + ":" + v)
        .join(",");
      if (stateStr !== (s.expiry_notified || "")) {
        await base44.asServiceRole.entities.Staff.update(s.id, { expiry_notified: stateStr });
      }
    }

    return Response.json({ success: true, sent: sentCount, total_staff: staff.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});