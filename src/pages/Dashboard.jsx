import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";
import StaffRequestsPanel from "../components/StaffRequestsPanel";
import WeeklyHoursPanel from "../components/WeeklyHoursPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, MapPin, Clock, Shield, AlertTriangle, CheckCircle2, ClipboardList, ArrowLeft, Building2, CalendarX2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CAPABILITY_LABELS, getRequirement, buildRequirementsMap, computeShortage, buildPool } from "@/lib/staffingRequirements";

function initials(name) {
  return (name || "").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("") || "?";
}

const STATUS_META = {
  scheduled: { label: "מתוכנן", variant: "secondary" },
  in_progress: { label: "בעיצומו", variant: "default" },
  completed: { label: "הושלם", variant: "secondary" },
  cancelled: { label: "בוטל", variant: "outline" },
  no_show: { label: "לא הגיע", variant: "destructive" },
};

export default function Dashboard() {
  const today = new Date().toISOString().split("T")[0];
  const [activeTab, setActiveTab] = useState("overview");

  const { data: staff = [], isLoading: staffLoading } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.Staff.list() });
  const { data: facilities = [], isLoading: facilitiesLoading } = useQuery({ queryKey: ["facilities"], queryFn: () => base44.entities.Facility.list() });
  const { data: posts = [], isLoading: postsLoading } = useQuery({ queryKey: ["posts"], queryFn: () => base44.entities.Post.list() });
  const { data: todayAssignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["assignments-today", today],
    queryFn: () => base44.entities.ShiftAssignment.filter({ date: today })
  });
  const { data: configs = [] } = useQuery({ queryKey: ["configs"], queryFn: () => base44.entities.SystemConfig.list() });
  const { data: requirementRecords = [] } = useQuery({ queryKey: ["staffing-requirements"], queryFn: () => base44.entities.StaffingRequirement.list() });
  const requirementsMap = useMemo(() => buildRequirementsMap(requirementRecords), [requirementRecords]);
  const isLoading = staffLoading || facilitiesLoading || postsLoading || assignmentsLoading;

  const activeStaff = staff.filter(s => s.status === "active");
  const guards = activeStaff.filter(s => s.role === "guard");
  const dispatchers = activeStaff.filter(s => s.role === "dispatcher");
  const emergencyMode = configs.find(c => c.key === "emergency_mode")?.value === "true";

  // Morning shift staffing check — לפי תקינת כיסוי לכל מתקן (מתחשב ביום בשבוע ובהיררכיית תפקידים)
  const staffMap = useMemo(() => {
    const m = {};
    staff.forEach((s) => (m[s.id] = s));
    return m;
  }, [staff]);

  const morningAssignments = todayAssignments.filter((a) => {
    const hour = new Date(a.actual_start).getHours();
    return hour >= 5 && hour < 12;
  });

  const morningCheck = useMemo(() => {
    const todayDate = new Date(today);
    const issues = [];
    facilities
      .filter((f) => f.status !== "inactive")
      .forEach((f) => {
        const req = getRequirement(f, todayDate, "morning", requirementsMap);
        if (!req) return;
        const facAssignments = morningAssignments.filter((a) => a.facility_id === f.id);
        const pool = buildPool(facAssignments, staffMap);
        const shortage = computeShortage(req, pool);
        if (shortage.totalShortage > 0) {
          issues.push({ facility: f, shortage });
        }
      });
    return { valid: issues.length === 0, issues };
  }, [facilities, today, morningAssignments, staffMap, requirementsMap]);

  const scheduledToday = todayAssignments.filter(a => a.status === "scheduled" || a.status === "in_progress");
  const emergencyOverrides = todayAssignments.filter(a => a.is_emergency_override);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="לוח בקרה"
        description={`סקירה ליום ${new Date().toLocaleDateString("he-IL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`}
      >
        {emergencyMode && (
          <Badge variant="destructive" className="gap-1.5 py-1.5 px-3">
            <AlertTriangle className="w-3.5 h-3.5" />
            מצב חירום פעיל
          </Badge>
        )}
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6 border border-border w-fit">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "overview" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          סקירה כללית
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === "requests" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          בקשות עובדים
        </button>
        <button
          onClick={() => setActiveTab("hours")}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === "hours" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          שעות שבועיות
        </button>
      </div>

      {activeTab === "requests" && (
        <div className="bg-card border border-border rounded-xl p-6">
          <StaffRequestsPanel />
        </div>
      )}

      {activeTab === "hours" && (
        <div className="bg-card border border-border rounded-xl p-6">
          <WeeklyHoursPanel />
        </div>
      )}

      {activeTab === "overview" && (<>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          loading={isLoading}
          icon={Users} tone="blue" to="/staff"
          label='מאבטחים פעילים' value={guards.length}
          sublabel={`${guards.filter(g => g.qualification === "shift_supervisor").length} אחמ"שים`}
        />
        <StatCard
          loading={isLoading}
          icon={Users} tone="purple" to="/staff"
          label='מוקדנים' value={dispatchers.length}
          sublabel={`${dispatchers.filter(d => d.qualification === "lead_dispatcher").length} אחראיות מוקד`}
        />
        <StatCard
          loading={isLoading}
          icon={Shield} tone="green" to="/smart-schedule"
          label='משמרות היום' value={scheduledToday.length}
          sublabel={emergencyOverrides.length > 0 ? `${emergencyOverrides.length} חריגות חירום` : "אין חריגות"}
        />
        <StatCard
          loading={isLoading}
          icon={MapPin} tone="amber" to="/posts"
          label='עמדות פעילות' value={posts.filter(p => p.status === "active").length}
          sublabel={`ב-${facilities.length} מתקנים`}
        />
      </div>

      {/* Morning Staffing & Facilities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Morning Staffing Check */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">איוש משמרת בוקר</h2>
            </div>
            {!isLoading && !morningCheck.valid && (
              <Badge variant="outline" className="text-[11px] border-amber-300 text-amber-700 bg-amber-50">
                {morningCheck.issues.length} מתקנים חסרים
              </Badge>
            )}
          </div>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          ) : morningCheck.valid ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium">כל דרישות האיוש המינימליות עומדות</span>
            </div>
          ) : (
            <div className="space-y-2">
              {morningCheck.issues.map(({ facility, shortage }) => (
                <div key={facility.id} className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-amber-900">{facility.name}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {shortage.details.filter(d => d.shortage > 0).map(d => (
                          <span key={d.capability} className="inline-flex items-center rounded-md bg-amber-100 border border-amber-300 text-amber-800 text-[11px] font-semibold px-2 py-0.5">
                            חסר {d.shortage} {CAPABILITY_LABELS[d.capability]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Link
                      to="/smart-schedule"
                      className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-amber-800 hover:text-amber-900 hover:underline"
                    >
                      לסידור
                      <ArrowLeft className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Facilities */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">מתקנים</h2>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : facilities.length === 0 ? (
            <EmptyState icon={Building2} title="אין מתקנים מוגדרים" description="הוסף מתקן בהגדרות המערכת כדי להתחיל." />
          ) : (
            <div className="space-y-2">
              {facilities.map(f => {
                const facilityStaff = activeStaff.filter(s => s.primary_facility === f.id);
                const facilityPosts = posts.filter(p => p.facility === f.id);
                const facilityShifts = scheduledToday.filter(a => a.facility_id === f.id);
                return (
                  <div key={f.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-transparent">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                        {f.code}
                      </div>
                      <p className="text-sm font-semibold truncate">{f.name}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{facilityStaff.length}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{facilityPosts.length}</span>
                      <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" />{facilityShifts.length}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Today's Assignments */}
      <div className="bg-card border border-border rounded-xl p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">שיבוצים היום</h2>
          </div>
          {!isLoading && scheduledToday.length > 10 && (
            <span className="text-xs text-muted-foreground">מציג 10 מתוך {scheduledToday.length}</span>
          )}
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
          </div>
        ) : scheduledToday.length === 0 ? (
          <EmptyState icon={CalendarX2} title="אין משמרות מתוכננות" description="לא נוצרו שיבוצים להיום עדיין." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">עובד</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">משמרת</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">עמדה</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">שעות</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {scheduledToday.slice(0, 10).map(a => {
                  const meta = STATUS_META[a.status] || { label: a.status, variant: "secondary" };
                  return (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-accent-foreground shrink-0">
                            {initials(a.staff_name)}
                          </div>
                          <span className="font-medium truncate">{a.staff_name}</span>
                          {a.is_emergency_override && (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className="text-xs">{a.shift_code}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground hidden sm:table-cell">{a.post_name || "—"}</td>
                      <td className="py-2.5 px-3 text-muted-foreground tabular-nums">
                        {new Date(a.actual_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – {new Date(a.actual_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant={meta.variant} className="text-xs">{meta.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}