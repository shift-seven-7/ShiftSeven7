import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/database.types";
import { AlertTriangle, CheckCircle2, Clock, HeartPulse, RefreshCw, ShieldCheck, type LucideIcon } from "lucide-react";

type Staff = Database["public"]["Tables"]["staff"]["Row"];

const CREDENTIALS: { key: keyof Staff; label: string; icon: LucideIcon }[] = [
  { key: "weapon_license_expiry", label: "רישיון נשק", icon: ShieldCheck },
  { key: "weapon_refresh_expiry", label: "רענון נשק", icon: RefreshCw },
  { key: "medical_check_expiry", label: "אישור רפואי", icon: HeartPulse },
];

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function statusFor(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T12:00:00");
  const days = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: "פג תוקף", badge: "bg-red-100 text-red-700", border: "border-red-200", icon: AlertTriangle };
  if (days <= 30) return { label: `בעוד ${days} ימים`, badge: "bg-red-100 text-red-700", border: "border-red-200", icon: AlertTriangle };
  if (days <= 60) return { label: `בעוד ${days} ימים`, badge: "bg-amber-100 text-amber-700", border: "border-amber-200", icon: Clock };
  return { label: `בעוד ${days} ימים`, badge: "bg-green-100 text-green-700", border: "border-green-200", icon: CheckCircle2 };
}

export default function CredentialsReminders({ staff }: { staff: Staff }) {
  const items = CREDENTIALS.map((c) => ({ ...c, date: staff[c.key] as string | null })).filter((c) => c.date);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">תוקפים ואישורים</h2>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <ShieldCheck className="w-8 h-8 text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">אין תוקפים מוגדרים עבורך. פנה למנהל המערכת לעדכון.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-3 gap-3">
          {items.map(({ key, label, icon: Icon, date }) => {
            const st = statusFor(date!);
            const SIcon = st.icon;
            return (
              <div key={key} className={cn("rounded-lg border p-4", st.border)}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold">{label}</span>
                </div>
                <p className="text-sm font-bold tabular-nums mb-1.5">{fmtDate(date!)}</p>
                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold", st.badge)}>
                  <SIcon className="w-3 h-3" />
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
