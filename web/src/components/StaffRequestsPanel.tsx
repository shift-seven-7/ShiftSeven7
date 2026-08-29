"use client";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, User } from "lucide-react";
import { useMemo, useState } from "react";

const HEB_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HEB_MONTHS_SHORT = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  morning: { bg: "#FEF9C3", border: "#FDE047", text: "#713F12" },
  afternoon: { bg: "#DBEAFE", border: "#60A5FA", text: "#1E3A8A" },
  night: { bg: "#EDE9FE", border: "#A78BFA", text: "#4C1D95" },
};

function getNextWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function StaffRequestsPanel() {
  const [weekAnchor, setWeekAnchor] = useState(getNextWeekStart());
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAnchor);
    d.setDate(weekAnchor.getDate() + i);
    return d;
  });
  const weekDateStrs = weekDays.map(toDateStr);
  const weekLabel = `${weekDays[0].getDate()} ${HEB_MONTHS_SHORT[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${HEB_MONTHS_SHORT[weekDays[6].getMonth()]}`;

  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("shift_templates").select("*");
      if (error) throw error;
      return data;
    },
  });
  const { data: staffData = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("staff").select("*");
      if (error) throw error;
      return data;
    },
  });
  const { data: requests = [] } = useQuery({
    queryKey: ["shift-requests-admin", weekDateStrs[0]],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("shift_requests")
        .select("*")
        .eq("week_start", weekDateStrs[0])
        .eq("status", "submitted");
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const navigateWeek = (dir: number) => {
    setWeekAnchor((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir * 7);
      return d;
    });
    setSelectedStaffId(null);
  };

  const byStaff = useMemo(() => {
    const m: Record<string, { name: string; requests: typeof requests }> = {};
    requests.forEach((r) => {
      if (!m[r.staff_id]) m[r.staff_id] = { name: r.staff_name, requests: [] };
      m[r.staff_id].requests.push(r);
    });
    return m;
  }, [requests]);

  const staffEntries = Object.entries(byStaff);

  const selectedRequestMap = useMemo(() => {
    if (!selectedStaffId || !byStaff[selectedStaffId]) return {};
    const m: Record<string, (typeof requests)[number]> = {};
    byStaff[selectedStaffId].requests.forEach((r) => {
      m[r.date] = r;
    });
    return m;
  }, [selectedStaffId, byStaff]);

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden">
          <button className="h-8 w-8 flex items-center justify-center hover:bg-muted transition-colors" onClick={() => navigateWeek(-1)}>
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="px-3 text-xs font-semibold min-w-[140px] text-center">{weekLabel}</span>
          <button className="h-8 w-8 flex items-center justify-center hover:bg-muted transition-colors" onClick={() => navigateWeek(1)}>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={() => {
            setWeekAnchor(getNextWeekStart());
            setSelectedStaffId(null);
          }}
          className="h-8 px-3 text-xs font-semibold border border-border rounded-lg bg-card hover:bg-muted transition-colors"
        >
          שבוע הבא
        </button>
      </div>

      {staffEntries.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>אין בקשות שהוגשו לשבוע זה</p>
        </div>
      ) : (
        <div className="flex gap-4">
          <div className="w-44 shrink-0 space-y-1">
            {staffEntries.map(([sid, { name, requests: reqs }]) => {
              const s = staffData.find((x) => x.id === sid);
              return (
                <button
                  key={sid}
                  onClick={() => setSelectedStaffId(sid === selectedStaffId ? null : sid)}
                  className={cn(
                    "w-full text-right px-3 py-2 rounded-lg text-sm font-medium border transition-all",
                    selectedStaffId === sid ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted",
                  )}
                >
                  <p className="font-semibold text-xs">{name}</p>
                  <p className="text-[10px] opacity-70">
                    {reqs.length} ימים · {s?.role === "guard" ? "מאבטח" : "מוקדן"}
                  </p>
                </button>
              );
            })}
          </div>

          {selectedStaffId && (
            <div className="flex-1 overflow-x-auto">
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-3 font-medium">
                ⚠️ זוהי בקשת העובד — אינה מחייבת. הסידור הסופי נקבע בדף &quot;ניהול סידור עבודה חכם&quot;
              </p>
              <div className="grid grid-cols-7 gap-1.5">
                {weekDays.map((d, i) => {
                  const dateStr = weekDateStrs[i];
                  const req = selectedRequestMap[dateStr];
                  const tpl = req ? templates.find((t) => t.id === req.shift_template_id) : null;
                  const colors = tpl ? CATEGORY_COLORS[tpl.category] : null;
                  return (
                    <div key={dateStr} className="flex flex-col gap-1">
                      <div className="text-center py-1.5 rounded-lg bg-muted/60 border border-border">
                        <p className="text-[10px] font-bold text-muted-foreground">{HEB_DAYS[d.getDay()]}</p>
                        <p className="text-xs font-semibold">
                          {d.getDate()}/{d.getMonth() + 1}
                        </p>
                      </div>
                      <div
                        className="rounded-lg border-2 min-h-[64px] flex flex-col items-center justify-center"
                        style={
                          colors
                            ? { background: colors.bg, borderColor: colors.border, borderStyle: "solid" }
                            : { borderStyle: "dashed", borderColor: "hsl(var(--border))" }
                        }
                      >
                        {tpl ? (
                          <div className="flex flex-col items-center gap-0.5 p-1">
                            <span className="font-black text-base leading-none" style={{ color: colors?.text }}>
                              {tpl.code}
                            </span>
                            <span className="text-[9px] font-semibold opacity-75" style={{ color: colors?.text }}>
                              {tpl.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
