import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { CalendarCheck, Download, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { exportSchedulePDF } from "../lib/exportSchedule";
import { Button } from "@/components/ui/button";
import { useImpersonation } from "@/lib/ImpersonationContext";

const HEB_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
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

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function isDark(hex) {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return (r*299 + g*587 + b*114) / 1000 < 128;
}

function exportCSV(assignments, templates, facilities, facilityId, staffData) {
  const facility = facilities.find(f => f.id === facilityId)?.name || "";
  const BOM = "\uFEFF";
  const headers = ["שם העובד","תאריך","קוד משמרת","שעת התחלה","שעת סיום","מתקן","עמדה"];
  const rows = assignments.map(a => {
    const tpl = templates.find(t => t.id === a.shift_template_id);
    const liveStaff = staffData ? staffData.find(x => x.id === a.staff_id) : null;
    const name = liveStaff?.full_name || a.staff_name;
    return [name, a.date, a.shift_code, formatTime(a.actual_start), formatTime(a.actual_end), facility, tpl?.post_number || ""]
      .map(v => `"${v}"`).join(",");
  });
  const csv = BOM + [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "סידור_עבודה.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function PublishedSchedulePage() {
  const [selectedFacilityId, setSelectedFacilityId] = useState(null);
  const [myShifts, setMyShifts] = useState(false);
  const [isGlobalView, setIsGlobalView] = useState(false);
  const { effectiveStaff: myStaffRecord } = useImpersonation();
  const [weekAnchor, setWeekAnchor] = useState(getWeekStart(new Date()));
  const [exporting, setExporting] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAnchor);
    d.setDate(weekAnchor.getDate() + i);
    return d;
  });
  const weekDateStrs = weekDays.map(toDateStr);
  const weekLabel = `${weekDays[0].getDate()} ${HEB_MONTHS_SHORT[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${HEB_MONTHS_SHORT[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`;

  const navigateWeek = (dir) => setWeekAnchor(prev => {
    const d = new Date(prev);
    d.setDate(d.getDate() + dir * 7);
    return d;
  });

  const { data: facilities = [] } = useQuery({ queryKey: ["facilities"], queryFn: () => base44.entities.Facility.list() });
  const { data: staffData = [] } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.Staff.list() });
  const { data: templates = [] } = useQuery({ queryKey: ["templates"], queryFn: () => base44.entities.ShiftTemplate.list() });

  const activeFacilities = facilities.filter(f => f.status !== "inactive");
  const effectiveFacilityId = selectedFacilityId || activeFacilities[0]?.id;

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["published-assignments", myShifts ? "mine" : isGlobalView ? "all" : effectiveFacilityId, weekDateStrs[0], myStaffRecord?.id],
    queryFn: async () => {
      if (myShifts && myStaffRecord) {
        // Fetch all published assignments for this staff member across all facilities
        const results = await Promise.all(
          weekDateStrs.map(date => base44.entities.ShiftAssignment.filter({ date, staff_id: myStaffRecord.id, is_published: true }))
        );
        return results.flat();
      }
      if (isGlobalView) {
        const results = await Promise.all(
          weekDateStrs.map(date => base44.entities.ShiftAssignment.filter({ date, is_published: true }))
        );
        return results.flat();
      }
      const results = await Promise.all(
        weekDateStrs.map(date => base44.entities.ShiftAssignment.filter({ date, facility_id: effectiveFacilityId, is_published: true }))
      );
      return results.flat();
    },
    enabled: myShifts ? !!myStaffRecord : isGlobalView ? true : !!effectiveFacilityId,
  });

  const active = assignments.filter(a => a.status !== "cancelled");

  const handleExportPDF = async () => {
    if (active.length === 0) return;
    setExporting(true);
    try {
      await exportSchedulePDF({
        assignments: active,
        templates,
        facilities,
        staffData,
        weekLabel,
        facilityName: isGlobalView ? "" : facilities.find(f => f.id === effectiveFacilityId)?.name || "",
      });
    } finally {
      setExporting(false);
    }
  };

  const sortedDates = weekDateStrs;

  const staffList = useMemo(() => {
    const map = {};
    active.forEach(a => {
      const live = staffData.find(x => x.id === a.staff_id);
      map[a.staff_id] = live?.full_name || a.staff_name;
    });
    let entries = Object.entries(map);
    if (myShifts && myStaffRecord) {
      entries = entries.filter(([sid]) => sid === myStaffRecord.id);
    }
    // Sort by hierarchy: shift_supervisor guards → guards → lead_dispatcher → dispatchers
    const rankOf = (sid) => {
      const s = staffData.find(x => x.id === sid);
      if (!s) return 99;
      if (s.role === 'guard' && s.qualification === 'shift_supervisor') return 0;
      if (s.role === 'guard') return 1;
      if (s.role === 'dispatcher' && s.qualification === 'lead_dispatcher') return 2;
      if (s.role === 'dispatcher') return 3;
      return 4;
    };
    entries.sort((a, b) => rankOf(a[0]) - rankOf(b[0]) || a[1].localeCompare(b[1], "he"));
    return entries;
  }, [active, myShifts, myStaffRecord, staffData]);

  const cellMap = useMemo(() => {
    const m = {};
    active.forEach(a => { m[`${a.staff_id}::${a.date}`] = a; });
    return m;
  }, [active]);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card border-b border-border px-5 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold">סידור עבודה סופי</h1>
              <p className="text-[11px] text-muted-foreground">משמרות מפורסמות בלבד — לקריאה בלבד</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Week Navigation */}
            <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden">
              <button className="h-8 w-8 flex items-center justify-center hover:bg-muted transition-colors" onClick={() => navigateWeek(-1)}>
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-semibold select-none min-w-[180px] text-center">{weekLabel}</span>
              <button className="h-8 w-8 flex items-center justify-center hover:bg-muted transition-colors" onClick={() => navigateWeek(1)}>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => setWeekAnchor(getWeekStart(new Date()))}
              className="h-8 px-3 text-xs font-semibold border border-border rounded-lg bg-card hover:bg-muted transition-colors">
              השבוע הנוכחי
            </button>
          <div className="flex gap-1 bg-muted rounded-lg p-0.5 border border-border">
              <button onClick={() => { setMyShifts(true); setIsGlobalView(false); }}
                className={cn("px-3 py-1 rounded-md text-xs font-semibold transition-all",
                  myShifts ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
                המשמרות שלי
              </button>
              {activeFacilities.map(f => (
                <button key={f.id} onClick={() => { setSelectedFacilityId(f.id); setMyShifts(false); setIsGlobalView(false); }}
                  className={cn("px-3 py-1 rounded-md text-xs font-semibold transition-all",
                    effectiveFacilityId === f.id && !myShifts && !isGlobalView ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
                  {f.name}
                </button>
              ))}
              <button onClick={() => { setIsGlobalView(true); setMyShifts(false); }}
                className={cn("px-3 py-1 rounded-md text-xs font-semibold transition-all",
                  isGlobalView ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
                כלל הצוות
              </button>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"
              onClick={handleExportPDF} disabled={exporting || active.length === 0}>
              {exporting ? <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              {exporting ? "מייצר..." : "ייצא PDF"}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"
              onClick={() => exportCSV(active, templates, facilities, effectiveFacilityId, staffData)}>
              <Download className="w-3.5 h-3.5" />
              ייצא לאקסל
            </Button>
          </div>
        </div>
      </div>

      {/* Matrix */}
      <div className="p-4 overflow-x-auto w-full">
        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="w-7 h-7 border-4 border-border border-t-primary rounded-full animate-spin" />
          </div>
        )}
        {!isLoading && sortedDates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <CalendarCheck className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="font-semibold text-muted-foreground">אין סידור מפורסם</p>
            <p className="text-sm text-muted-foreground/60 mt-1">הסידור יופיע כאן לאחר שהמנהל יפרסם אותו</p>
          </div>
        )}
        {!isLoading && sortedDates.length > 0 && (
          <table className="border-collapse w-full" style={{ borderSpacing: 0, direction: "rtl", tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th className="sticky right-0 z-10 bg-gray-800 text-white text-xs font-bold px-3 py-2 border border-gray-600 text-right whitespace-nowrap" style={{ width: 140 }}>
                  שם עובד
                </th>
                {sortedDates.map(date => {
                  const d = new Date(date + "T12:00:00");
                  return (
                    <th key={date} className="bg-gray-800 text-white text-xs font-bold px-2 py-2 border border-gray-600 text-center">
                      <div>{HEB_DAYS[d.getDay()]}</div>
                      <div className="font-normal opacity-70 text-[10px]">{d.getDate()}/{d.getMonth()+1}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {staffList.map(([staffId, staffName], ri) => {
                const s = staffData.find(x => x.id === staffId);
                const isFirstDispatcher = s?.role === 'dispatcher' && ri > 0 && (() => {
                  const prev = staffData.find(x => x.id === staffList[ri-1][0]);
                  return prev?.role === 'guard';
                })();
                return (
                  <>
                    {isFirstDispatcher && (
                      <tr key={staffId + '_sep'}>
                        <td colSpan={sortedDates.length + 1} style={{ padding: 0, height: 0 }}>
                          <div style={{ borderTop: '4px solid #1a1a1a', width: '100%' }} />
                        </td>
                      </tr>
                    )}
                    <tr key={staffId}>
                      <td className="sticky right-0 z-10 text-xs font-semibold px-3 py-2 border border-gray-400 text-right whitespace-nowrap"
                        style={{ background: ri % 2 === 0 ? "#f3f4f6" : "#e9eaec", width: 140 }}>
                        {staffName}
                      </td>
                      {sortedDates.map(date => {
                        const a = cellMap[`${staffId}::${date}`];
                        const tpl = a ? templates.find(t => t.id === a.shift_template_id) : null;
                        const color = tpl?.color || null;
                        const dark = color ? isDark(color) : false;
                        return (
                          <td key={date} className="border border-gray-400 text-center p-1 text-xs"
                            style={{ background: color || (ri % 2 === 0 ? "#ffffff" : "#f9fafb") }}>
                            {a && tpl && (
                              <div className="flex flex-col items-center justify-center gap-0.5 leading-tight">
                                <span className="font-black text-sm leading-none" style={{ color: dark ? "#fff" : "#111" }}>
                                  {a.shift_code}
                                </span>
                                {tpl.post_number && (
                                  <span className="text-[10px] font-semibold opacity-80" style={{ color: dark ? "#ffffffcc" : "#333" }}>
                                    ע׳{tpl.post_number}
                                  </span>
                                )}
                                <span className="text-[9px] opacity-60" style={{ color: dark ? "#ffffffaa" : "#555" }}>
                                  {formatTime(a.actual_start)}
                                </span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}