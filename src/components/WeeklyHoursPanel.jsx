import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Clock, AlertTriangle, CheckCircle2, Users, Timer, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const HEB_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HEB_DAYS_SHORT = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const HEB_MONTHS_SHORT = ["ינו","פבר","מרץ","אפר","מאי","יוני","יולי","אוג","ספט","אוק","נוב","דצמ"];

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function StatCard({ icon: Icon, label, value, sublabel, color }) {
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

export default function WeeklyHoursPanel() {
  const [weekAnchor, setWeekAnchor] = useState(getWeekStart(new Date()));
  const [facilityFilter, setFacilityFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const { data: facilities = [] } = useQuery({ queryKey: ["facilities"], queryFn: () => base44.entities.Facility.list() });

  const weekStart = toDateStr(weekAnchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAnchor);
    d.setDate(weekAnchor.getDate() + i);
    return d;
  });
  const weekLabel = `${weekDays[0].getDate()} ${HEB_MONTHS_SHORT[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${HEB_MONTHS_SHORT[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`;

  const navigateWeek = (dir) => setWeekAnchor(prev => {
    const d = new Date(prev);
    d.setDate(d.getDate() + dir * 7);
    return d;
  });

  const { data, isLoading } = useQuery({
    queryKey: ["weekly-hours", weekStart, facilityFilter],
    queryFn: async () => {
      const res = await base44.functions.invoke('calculateWeeklyHours', {
        week_start: weekStart,
        facility_id: facilityFilter === "all" ? "" : facilityFilter,
      });
      return res.data;
    },
  });

  const staffHours = data?.staff_hours || [];
  const maxHours = data?.max_hours || 60;
  const violationCount = data?.violation_count || 0;
  const totalStaff = data?.total_staff || 0;
  const totalHoursAll = data?.total_hours_all || 0;
  const avgHours = data?.avg_hours || 0;

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden">
            <button className="h-8 w-8 flex items-center justify-center hover:bg-muted transition-colors" onClick={() => navigateWeek(-1)}>
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-semibold select-none min-w-[180px] text-center">{weekLabel}</span>
            <button className="h-8 w-8 flex items-center justify-center hover:bg-muted transition-colors" onClick={() => navigateWeek(1)}>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setWeekAnchor(getWeekStart(new Date()))}
            className="h-8 px-3 text-xs font-semibold border border-border rounded-lg bg-card hover:bg-muted transition-colors">
            השבוע
          </button>
        </div>

        <div className="flex gap-1 bg-muted rounded-lg p-0.5 border border-border">
          <button onClick={() => setFacilityFilter("all")}
            className={cn("px-3 py-1 rounded-md text-xs font-semibold transition-all",
              facilityFilter === "all" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
            כל המתקנים
          </button>
          {facilities.filter(f => f.status !== "inactive").map(f => (
            <button key={f.id} onClick={() => setFacilityFilter(f.id)}
              className={cn("px-3 py-1 rounded-md text-xs font-semibold transition-all",
                facilityFilter === f.id ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      {!isLoading && staffHours.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard icon={Users} label="עובדים פעילים" value={totalStaff} sublabel="עם משמרות השבוע" color="bg-blue-50 text-blue-600" />
          <StatCard icon={Timer} label="סך שעות השבוע" value={totalHoursAll} sublabel="כל העובדים" color="bg-purple-50 text-purple-600" />
          <StatCard icon={TrendingUp} label="ממוצע לעובד" value={`${avgHours} שע׳`} sublabel={`מתוך מכסת ${maxHours}`} color="bg-green-50 text-green-600" />
          <StatCard icon={violationCount > 0 ? AlertTriangle : CheckCircle2} label="חריגות מכסה" value={violationCount}
            sublabel={violationCount > 0 ? "דורש טיפול" : "הכל תקין"}
            color={violationCount > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"} />
        </div>
      )}

      {/* Summary Banner */}
      {!isLoading && staffHours.length > 0 && (
        <div className="mb-4">
          {violationCount > 0 ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
              <AlertTriangle className="w-4 h-4" />
              {violationCount} עובדים חורגים ממכסת {maxHours} השעות — נדרש תיקון סידור
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              כל העובדים בתחום המכסה ({maxHours} שעות)
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : staffHours.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Clock className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">אין שיבוצים לשבוע זה</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="w-8 py-2 px-2"></th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">עובד</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">תפקיד</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground min-w-[140px]">התקדמות מול מכסה</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">סך שעות</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {staffHours.map(h => {
                const pct = Math.min(100, (h.total_hours / maxHours) * 100);
                const isExpanded = expandedId === h.staff_id;
                const barColor = h.is_over_limit ? "bg-red-500" : h.remaining_hours <= 5 ? "bg-amber-500" : "bg-green-500";
                return (
                  <>
                    <tr key={h.staff_id} className={cn("border-b border-border/50 transition-colors cursor-pointer",
                      h.is_over_limit ? "bg-red-50/40" : "hover:bg-muted/30")}
                      onClick={() => setExpandedId(isExpanded ? null : h.staff_id)}>
                      <td className="py-2.5 px-2 text-muted-foreground">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </td>
                      <td className="py-2.5 px-3 font-medium">{h.staff_name}</td>
                      <td className="py-2.5 px-3 text-muted-foreground hidden sm:table-cell">
                        {h.role === "guard" ? "מאבטח" : h.role === "dispatcher" ? "מוקדן" : h.role}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden min-w-[80px]">
                            <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{Math.round(pct)}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-bold tabular-nums">{h.total_hours}<span className="text-[10px] font-normal text-muted-foreground">/{maxHours}</span></td>
                      <td className="py-2.5 px-3">
                        {h.is_over_limit ? (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            חריגה
                          </Badge>
                        ) : h.remaining_hours <= 5 ? (
                          <Badge className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-100">קרוב למכסה</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">תקין</Badge>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={h.staff_id + "_detail"} className="bg-muted/20">
                        <td colSpan={6} className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold text-muted-foreground">פילוח יומי — {h.shift_count} משמרות</span>
                          </div>
                          <div className="grid grid-cols-7 gap-2">
                            {weekDays.map((d, i) => {
                              const hours = h.daily_hours?.[i] || 0;
                              const isToday = toDateStr(new Date()) === toDateStr(d);
                              return (
                                <div key={i} className={cn("rounded-lg border p-2 text-center transition-all",
                                  hours > 0 ? "border-primary/30 bg-card" : "border-border/50 bg-muted/30",
                                  isToday && "ring-2 ring-primary/40")}>
                                  <p className="text-[10px] font-semibold text-muted-foreground">{HEB_DAYS_SHORT[i]}</p>
                                  <p className="text-[10px] text-muted-foreground mb-1">{d.getDate()}/{d.getMonth()+1}</p>
                                  <p className={cn("text-sm font-bold tabular-nums", hours > 0 ? "text-foreground" : "text-muted-foreground/40")}>
                                    {hours}
                                  </p>
                                  <p className="text-[8px] text-muted-foreground">שע׳</p>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}