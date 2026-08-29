"use client";

import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Clock, MapPin } from "lucide-react";
import { useMemo } from "react";

const HEB_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HEB_MONTHS_SHORT = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];

function formatTime(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function textOn(hex?: string | null) {
  if (!hex || hex.length < 7) return "#1f2937";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128 ? "#ffffff" : "#1f2937";
}

export default function UpcomingShifts({ staffId }: { staffId: string }) {
  const { data: assignments = [] } = useQuery({
    queryKey: ["my-upcoming-shifts", staffId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("shift_assignments")
        .select("*")
        .eq("staff_id", staffId)
        .eq("is_published", true);
      if (error) throw error;
      return data;
    },
    enabled: !!staffId,
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("shift_templates").select("*");
      if (error) throw error;
      return data;
    },
  });
  const { data: facilities = [] } = useQuery({
    queryKey: ["facilities"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("facilities").select("*");
      if (error) throw error;
      return data;
    },
  });

  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return assignments
      .filter((a) => a.status === "scheduled" && a.is_published && new Date(a.date + "T12:00:00") >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6);
  }, [assignments]);

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <CalendarClock className="w-4 h-4 text-primary" />
        </div>
        <h2 className="text-sm font-bold">המשמרות הקרובות שלי</h2>
      </div>

      {upcoming.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground">אין משמרות מפורסמות לשבועות הקרובים.</div>
      ) : (
        <div className="space-y-2">
          {upcoming.map((a) => {
            const tpl = templates.find((t) => t.id === a.shift_template_id);
            const facility = facilities.find((f) => f.id === a.facility_id);
            const d = new Date(a.date + "T12:00:00");
            const color = tpl?.color;
            return (
              <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-background/50">
                <div className="shrink-0 w-12 text-center">
                  <p className="text-[10px] text-muted-foreground">{HEB_DAYS[d.getDay()]}</p>
                  <p className="text-lg font-bold leading-none">{d.getDate()}</p>
                  <p className="text-[10px] text-muted-foreground">{HEB_MONTHS_SHORT[d.getMonth()]}</p>
                </div>

                <span
                  className="shrink-0 inline-flex items-center justify-center min-w-[44px] px-2 py-1 rounded-md text-xs font-black"
                  style={{ background: color || "#e5e7eb", color: textOn(color || "#e5e7eb") }}
                >
                  {a.shift_code}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">
                    {tpl?.name || a.shift_code} · {a.post_name || "—"}
                  </p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(a.actual_start)}–{formatTime(a.actual_end)}
                    </span>
                    {facility && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3" />
                        {facility.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
