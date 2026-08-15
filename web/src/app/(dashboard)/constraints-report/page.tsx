"use client";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileWarning } from "lucide-react";
import { useMemo, useState } from "react";

type ShiftAssignment = Database["public"]["Tables"]["shift_assignments"]["Row"];
type ShiftRequest = Database["public"]["Tables"]["shift_requests"]["Row"];

const HEB_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HEB_MONTHS_SHORT = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];

function getWeekStart(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

type Status = "fulfilled" | "conflict" | "pending";
const STATUS_META: Record<Status, { label: string; color: string; dot: string }> = {
  fulfilled: { label: "מאויש כמבוקש", color: "bg-green-100 text-green-700 hover:bg-green-100", dot: "bg-green-500" },
  conflict: { label: "מתנגש עם השיבוץ", color: "bg-red-100 text-red-700 hover:bg-red-100", dot: "bg-red-500" },
  pending: { label: "ממתין לשיבוץ", color: "bg-amber-100 text-amber-700 hover:bg-amber-100", dot: "bg-amber-500" },
};

function StatCard({ icon: Icon, label, value, sublabel, color }: { icon: typeof CalendarDays; label: string; value: number; sublabel?: string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold leading-tight">{value}</p>
        {sublabel && <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

export default function ConstraintsReportPage() {
  const [weekAnchor, setWeekAnchor] = useState(getWeekStart(new Date()));
  const [facilityFilter, setFacilityFilter] = useState("all");
  const [filterMode, setFilterMode] = useState<"all" | Status>("all");

  const { data: facilities = [] } = useQuery({
    queryKey: ["facilities"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("facilities").select("*");
      if (error) throw error;
      return data;
    },
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

  const weekStart = toDateStr(weekAnchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAnchor);
    d.setDate(weekAnchor.getDate() + i);
    return d;
  });
  const weekDateStrs = weekDays.map(toDateStr);
  const weekLabel = `${weekDays[0].getDate()} ${HEB_MONTHS_SHORT[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${HEB_MONTHS_SHORT[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`;

  const navigateWeek = (dir: number) =>
    setWeekAnchor((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir * 7);
      return d;
    });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["constraints-report", weekStart, facilityFilter],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase.from("shift_requests").select("*").eq("week_start", weekStart).eq("status", "submitted");
      if (facilityFilter !== "all") query = query.eq("facility_id", facilityFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["report-assignments", weekStart, facilityFilter],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase.from("shift_assignments").select("*").gte("date", weekDateStrs[0]).lte("date", weekDateStrs[6]);
      if (facilityFilter !== "all") query = query.eq("facility_id", facilityFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const assignmentMap = useMemo(() => {
    const m: Record<string, ShiftAssignment> = {};
    assignments
      .filter((a) => a.status !== "cancelled")
      .forEach((a) => {
        m[`${a.staff_id}::${a.date}`] = a;
      });
    return m;
  }, [assignments]);

  const enriched = useMemo(() => {
    return requests.map((r) => {
      const assignment = assignmentMap[`${r.staff_id}::${r.date}`];
      let status: Status = "pending";
      if (assignment) {
        status = assignment.shift_template_id === r.shift_template_id ? "fulfilled" : "conflict";
      }
      return { request: r, status, assignment };
    });
  }, [requests, assignmentMap]);

  const counts = useMemo(
    () => ({
      total: enriched.length,
      fulfilled: enriched.filter((e) => e.status === "fulfilled").length,
      conflict: enriched.filter((e) => e.status === "conflict").length,
      pending: enriched.filter((e) => e.status === "pending").length,
    }),
    [enriched],
  );

  const filtered = useMemo(() => {
    const list = filterMode === "all" ? enriched : enriched.filter((e) => e.status === filterMode);
    return [...list].sort((a, b) => (a.request.staff_name || "").localeCompare(b.request.staff_name || "") || a.request.date.localeCompare(b.request.date));
  }, [enriched, filterMode]);

  const tplName = (id: string) => templates.find((t) => t.id === id);
  const fmtDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return `${HEB_DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileWarning className="w-6 h-6 text-primary" />
            דוח אילוצים
          </h1>
          <p className="text-sm text-muted-foreground mt-1">מרכוז בקשות עובדים וזיהוי התנגשויות עם השיבוץ בפועל</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden">
            <button className="h-8 w-8 flex items-center justify-center hover:bg-muted transition-colors" onClick={() => navigateWeek(-1)}>
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-semibold select-none min-w-[160px] text-center">{weekLabel}</span>
            <button className="h-8 w-8 flex items-center justify-center hover:bg-muted transition-colors" onClick={() => navigateWeek(1)}>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setWeekAnchor(getWeekStart(new Date()))} className="h-8 px-3 text-xs font-semibold border border-border rounded-lg bg-card hover:bg-muted transition-colors">
            השבוע
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-muted rounded-lg p-0.5 border border-border mb-5 w-fit">
        <button onClick={() => setFacilityFilter("all")} className={cn("px-3 py-1.5 rounded-md text-xs font-semibold transition-all", facilityFilter === "all" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
          כל המתקנים
        </button>
        {facilities
          .filter((f) => f.status !== "inactive")
          .map((f) => (
            <button key={f.id} onClick={() => setFacilityFilter(f.id)} className={cn("px-3 py-1.5 rounded-md text-xs font-semibold transition-all", facilityFilter === f.id ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
              {f.name}
            </button>
          ))}
      </div>

      {!isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard icon={CalendarDays} label="סה״כ בקשות" value={counts.total} sublabel="בקשות שהוגשו" color="bg-blue-50 text-blue-600" />
          <StatCard icon={CheckCircle2} label="מאויש כמבוקש" value={counts.fulfilled} sublabel="הבקשה כובדה" color="bg-green-50 text-green-600" />
          <StatCard icon={AlertTriangle} label="מתנגשים" value={counts.conflict} sublabel={counts.conflict > 0 ? "דורש טיפול" : "אין התנגשויות"} color={counts.conflict > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"} />
          <StatCard icon={Clock} label="ממתינות לשיבוץ" value={counts.pending} sublabel="טרם שובצו" color="bg-amber-50 text-amber-600" />
        </div>
      )}

      <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 border border-border mb-3 w-fit">
        {(
          [
            { key: "all", label: `הכל (${counts.total})` },
            { key: "conflict", label: `מתנגשים (${counts.conflict})` },
            { key: "pending", label: `ממתינות (${counts.pending})` },
            { key: "fulfilled", label: `מאוישות (${counts.fulfilled})` },
          ] as const
        ).map((t) => (
          <button key={t.key} onClick={() => setFilterMode(t.key)} className={cn("px-3 py-1.5 rounded-md text-xs font-semibold transition-all", filterMode === t.key ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileWarning className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">{counts.total === 0 ? "אין בקשות שהוגשו לשבוע זה" : "אין בקשות בסינון זה"}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">עובד</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">תאריך</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">משמרת מבוקשת</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">שובץ בפועל</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ request: r, status, assignment }: { request: ShiftRequest; status: Status; assignment?: ShiftAssignment }, idx) => {
                const reqTpl = tplName(r.shift_template_id);
                const meta = STATUS_META[status];
                return (
                  <tr key={idx} className={cn("border-b border-border/50", status === "conflict" ? "bg-red-50/40" : status === "fulfilled" ? "bg-green-50/30" : "hover:bg-muted/20")}>
                    <td className="py-2.5 px-3 font-medium">{r.staff_name}</td>
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-muted">{r.shift_code}</span>
                        {reqTpl && (
                          <span className="text-xs text-muted-foreground">
                            {formatTime(reqTpl.start_time)}–{formatTime(reqTpl.end_time)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      {assignment ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-muted">{assignment.shift_code}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(assignment.actual_start)}–{formatTime(assignment.actual_end)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">— טרם שובץ</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold", meta.color)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
