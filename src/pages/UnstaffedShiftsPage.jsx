import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import {
  AlertCircle, ChevronLeft, ChevronRight, Shield, UserX, CalendarX, ArrowLeft, CheckCircle2,
} from "lucide-react";
import {
  STAFFING_REQUIREMENTS, CATEGORY_LABELS, CATEGORY_ORDER, CAPABILITY_LABELS,
  getFacilityRequirementConfig, getRequirement, capabilityOf, computeShortage, shortageText, buildRequirementsMap,
} from "@/lib/staffingRequirements";

const HEB_DAYS_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
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

function requirementLabel(req) {
  if (!req) return "";
  return Object.keys(req)
    .filter((k) => req[k] > 0)
    .map((k) => `${CAPABILITY_LABELS[k]} ${req[k]}`)
    .join(" + ");
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

export default function UnstaffedShiftsPage() {
  const [weekAnchor, setWeekAnchor] = useState(getWeekStart(new Date()));
  const [selectedFacilityId, setSelectedFacilityId] = useState(null);
  const [showGapsOnly, setShowGapsOnly] = useState(true);

  const { data: facilities = [] } = useQuery({ queryKey: ["facilities"], queryFn: () => base44.entities.Facility.list() });
  const { data: templates = [] } = useQuery({ queryKey: ["shift-templates"], queryFn: () => base44.entities.ShiftTemplate.list() });
  const { data: staff = [] } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.Staff.list() });

  const activeFacilities = facilities.filter((f) => f.status !== "inactive");
  const effectiveFacilityId = selectedFacilityId || activeFacilities[0]?.id;
  const effectiveFacility = facilities.find((f) => f.id === effectiveFacilityId);
  const facilityName = effectiveFacility?.name || "";
  const { data: requirementRecords = [] } = useQuery({
    queryKey: ["staffing-requirements"],
    queryFn: () => base44.entities.StaffingRequirement.list(),
  });
  const requirementsMap = useMemo(() => buildRequirementsMap(requirementRecords), [requirementRecords]);
  const facilityHasRequirements = !!getFacilityRequirementConfig(effectiveFacility, requirementsMap);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAnchor);
    d.setDate(weekAnchor.getDate() + i);
    return d;
  });
  const weekDateStrs = weekDays.map(toDateStr);
  const weekLabel = `${weekDays[0].getDate()} ${HEB_MONTHS_SHORT[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${HEB_MONTHS_SHORT[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`;
  const todayStr = toDateStr(new Date());

  const navigateWeek = (dir) =>
    setWeekAnchor((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir * 7);
      return d;
    });

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["gap-assignments", effectiveFacilityId, weekDateStrs[0]],
    queryFn: async () => {
      const results = await Promise.all(
        weekDateStrs.map((date) => base44.entities.ShiftAssignment.filter({ date, facility_id: effectiveFacilityId }))
      );
      return results.flat();
    },
    enabled: !!effectiveFacilityId,
  });

  const templateMap = useMemo(() => {
    const m = {};
    templates.forEach((t) => (m[t.id] = t));
    return m;
  }, [templates]);

  const staffMap = useMemo(() => {
    const m = {};
    staff.forEach((s) => (m[s.id] = s));
    return m;
  }, [staff]);

  // בריכת יכולות לכל (קטגוריה, תאריך)
  const poolMap = useMemo(() => {
    const m = {};
    assignments
      .filter((a) => a.status !== "cancelled" && a.shift_template_id)
      .forEach((a) => {
        const cat = templateMap[a.shift_template_id]?.category;
        if (!cat) return;
        const cap = capabilityOf(staffMap[a.staff_id]);
        const key = `${cat}::${a.date}`;
        if (!m[key]) m[key] = { supervisor: 0, guard: 0, dispatcher: 0 };
        m[key][cap] = (m[key][cap] || 0) + 1;
      });
    return m;
  }, [assignments, templateMap, staffMap]);

  const rows = useMemo(() => {
    const cats = CATEGORY_ORDER.filter((cat) =>
      weekDays.some((d) => getRequirement(effectiveFacility, d, cat, requirementsMap))
    );
    return cats.map((cat) => {
      const days = weekDays.map((d) => {
        const date = toDateStr(d);
        const req = getRequirement(effectiveFacility, d, cat, requirementsMap);
        if (!req) return { date, hasReq: false, shortage: null };
        const pool = poolMap[`${cat}::${date}`] || {};
        const shortage = computeShortage(req, pool);
        return { date, hasReq: true, req, shortage };
      });
      const gapCount = days.filter((d) => d.hasReq && d.shortage.totalShortage > 0).length;
      return { cat, days, gapCount };
    });
  }, [effectiveFacility, weekDays, poolMap, requirementsMap]);

  const visibleRows = showGapsOnly ? rows.filter((r) => r.gapCount > 0) : rows;

  const totalRequiredSlots = rows.reduce(
    (sum, r) => sum + r.days.filter((d) => d.hasReq).reduce((s, d) => s + d.shortage.totalRequired, 0),
    0
  );
  const totalAssignedSlots = rows.reduce(
    (sum, r) => sum + r.days.filter((d) => d.hasReq).reduce((s, d) => s + d.shortage.totalAssigned, 0),
    0
  );
  const totalShortage = rows.reduce(
    (sum, r) => sum + r.days.filter((d) => d.hasReq).reduce((s, d) => s + d.shortage.totalShortage, 0),
    0
  );
  const daysWithGaps = weekDateStrs.filter((date) =>
    rows.some((r) => r.days.find((d) => d.date === date && d.hasReq && d.shortage.totalShortage > 0))
  ).length;

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-amber-500" />
            פערי סידור
          </h1>
          <p className="text-sm text-muted-foreground mt-1">כיסוי משמרות מול תקינת כוח אדם — להשלמה מהירה</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden">
            <button className="h-8 w-8 flex items-center justify-center hover:bg-muted transition-colors" onClick={() => navigateWeek(-1)}>
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-semibold select-none min-w-[160px] text-center">{weekLabel}</span>
            <button className="h-8 w-8 flex items-center justify-center hover:bg-muted transition-colors" onClick={() => navigateWeek(1)}>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setWeekAnchor(getWeekStart(new Date()))}
            className="h-8 px-3 text-xs font-semibold border border-border rounded-lg bg-card hover:bg-muted transition-colors"
          >
            השבוע
          </button>
        </div>
      </div>

      {/* Facility selector */}
      <div className="flex gap-1 bg-muted rounded-lg p-0.5 border border-border mb-5 w-fit">
        {activeFacilities.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedFacilityId(f.id)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
              effectiveFacilityId === f.id ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f.name}
          </button>
        ))}
      </div>

      {!facilityHasRequirements && !isLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Shield className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">אין תקינת כיסוי מוגדרת למתקן {facilityName}</p>
          <p className="text-xs text-muted-foreground mt-1">יש להגדיר דרישות כיסוי בקובץ התקינה</p>
        </div>
      )}

      {/* Stat Cards */}
      {facilityHasRequirements && !isLoading && totalRequiredSlots > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard icon={Shield} label="משבצות נדרשות" value={totalRequiredSlots} sublabel={`במתקן ${facilityName}`} color="bg-blue-50 text-blue-600" />
          <StatCard icon={CheckCircle2} label="משבצות מאוישות" value={totalAssignedSlots} sublabel={`מתוך ${totalRequiredSlots}`} color="bg-green-50 text-green-600" />
          <StatCard icon={CalendarX} label="ימים עם פערים" value={daysWithGaps} sublabel="מתוך 7 ימי השבוע" color="bg-amber-50 text-amber-600" />
          <StatCard icon={AlertCircle} label="סה״כ פערים" value={totalShortage} sublabel="משבצות ללא כיסוי" color={totalShortage > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"} />
        </div>
      )}

      {/* Toggle */}
      {facilityHasRequirements && rows.length > 0 && (
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex gap-1 bg-muted rounded-lg p-0.5 border border-border">
            <button
              onClick={() => setShowGapsOnly(true)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                showGapsOnly ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              )}
            >
              פערים בלבד ({rows.filter((r) => r.gapCount > 0).length})
            </button>
            <button
              onClick={() => setShowGapsOnly(false)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                !showGapsOnly ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              )}
            >
              כל המשמרות ({rows.length})
            </button>
          </div>
          {totalShortage > 0 && (
            <Link
              to="/smart-schedule"
              className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              עבור לסידור החכם להשלמה
            </Link>
          )}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : facilityHasRequirements && rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-500 mb-3" />
          <p className="text-sm font-semibold text-green-700">אין דרישות כיסוי לשבוע זה</p>
          <p className="text-xs text-muted-foreground mt-1">במתקן {facilityName}</p>
        </div>
      ) : facilityHasRequirements && visibleRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-500 mb-3" />
          <p className="text-sm font-semibold text-green-700">כל המשמרות מאוישות השבוע!</p>
          <p className="text-xs text-muted-foreground mt-1">אין פערי סידור במתקן {facilityName}</p>
        </div>
      ) : facilityHasRequirements ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground sticky right-0 bg-background" style={{ minWidth: 200 }}>
                  משמרת
                </th>
                {weekDays.map((d, i) => (
                  <th key={i} className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">
                    <div>{HEB_DAYS_SHORT[i]}</div>
                    <div className="font-normal opacity-60 text-[10px]">
                      {d.getDate()}/{d.getMonth() + 1}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(({ cat, days, gapCount }) => (
                <tr key={cat} className={cn("border-b border-border/50", gapCount > 0 ? "bg-red-50/30" : "hover:bg-muted/20")}>
                  <td className="py-2.5 px-3 sticky right-0 bg-inherit">
                    <div className="font-medium">{CATEGORY_LABELS[cat]}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">{requirementLabel(getRequirement(effectiveFacility, weekDays[0], cat, requirementsMap))}</span>
                      {gapCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">{gapCount} פערים</span>
                      )}
                    </div>
                  </td>
                  {days.map(({ date, hasReq, req, shortage }) => {
                    const isToday = date === todayStr;
                    if (!hasReq) {
                      return (
                        <td key={date} className={cn("text-center py-2 px-1 border border-border/30", isToday && "ring-1 ring-primary/30")}>
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-muted/40 text-muted-foreground/40 text-xs">—</span>
                        </td>
                      );
                    }
                    const isGap = shortage.totalShortage > 0;
                    const title = `נדרש: ${requirementLabel(req)}\nמאויש: ${shortage.totalAssigned}/${shortage.totalRequired}\n${isGap ? "חסר: " + shortageText(shortage) : "מלא"}`;
                    return (
                      <td key={date} className={cn("text-center py-2 px-1 border border-border/30", isToday && "ring-1 ring-primary/30")}>
                        {isGap ? (
                          <Link
                            to="/smart-schedule"
                            title={title}
                            className="inline-flex flex-col items-center justify-center w-12 h-10 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                          >
                            <span className="text-[11px] font-bold leading-none">חסר {shortage.totalShortage}</span>
                            <span className="text-[9px] leading-none mt-0.5 opacity-80">{shortage.totalAssigned}/{shortage.totalRequired}</span>
                          </Link>
                        ) : (
                          <span
                            title={title}
                            className="inline-flex flex-col items-center justify-center w-12 h-10 rounded-lg bg-green-50 text-green-700"
                          >
                            <span className="text-[11px] font-bold leading-none">✓</span>
                            <span className="text-[9px] leading-none mt-0.5 opacity-80">{shortage.totalAssigned}/{shortage.totalRequired}</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Legend */}
      {facilityHasRequirements && !isLoading && visibleRows.length > 0 && (
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-8 h-6 rounded bg-green-50 text-green-700 font-bold text-[11px]">✓</span>
            מאויש (מאויש/נדרש)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-8 h-6 rounded bg-red-100 text-red-700 font-bold text-[11px]">חסר</span>
            פער כיסוי — לחץ לשיבוץ
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-8 h-6 rounded bg-muted/40 text-muted-foreground/40 text-xs">—</span>
            לא נדרש (אין משמרת)
          </div>
        </div>
      )}
    </div>
  );
}