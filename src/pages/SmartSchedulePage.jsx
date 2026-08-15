import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "../components/PageHeader";
import WeeklyMatrix from "../components/SmartSchedule/WeeklyMatrix";
import ShiftCardsPanel from "../components/SmartSchedule/ShiftCardsPanel";
import { DragDropContext } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateRestPeriod } from "../lib/shiftValidation";
import { toast } from "sonner";

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const HEB_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HEB_MONTHS_SHORT = ["ינו","פבר","מרץ","אפר","מאי","יוני","יולי","אוג","ספט","אוק","נוב","דצמ"];

export default function SmartSchedulePage() {
  const qc = useQueryClient();
  const [weekAnchor, setWeekAnchor] = useState(getWeekStart(new Date()));
  const [selectedFacilityId, setSelectedFacilityId] = useState(null);

  const { data: facilities = [] } = useQuery({ queryKey: ["facilities"], queryFn: () => base44.entities.Facility.list() });
  const { data: staff = [] } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.Staff.list() });
  const { data: templates = [] } = useQuery({ queryKey: ["templates"], queryFn: () => base44.entities.ShiftTemplate.list() });
  const { data: posts = [] } = useQuery({ queryKey: ["posts"], queryFn: () => base44.entities.Post.list() });

  const activeFacilities = facilities.filter(f => f.status !== "inactive");
  // null = global view
  const effectiveFacilityId = selectedFacilityId === "all" ? null : (selectedFacilityId || activeFacilities[0]?.id);
  const isGlobalView = selectedFacilityId === "all";
  const currentFacility = activeFacilities.find(f => f.id === effectiveFacilityId);

  // Detect if this facility has a control room (dispatchers applicable)
  const facilityPosts = isGlobalView
    ? posts.filter(p => p.status === "active")
    : posts.filter(p => p.facility === effectiveFacilityId && p.status === "active");
  const hasControlRoom = isGlobalView
    ? posts.some(p => p.type === "control_room" && p.status === "active")
    : facilityPosts.some(p => p.type === "control_room");

  // Week days array
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAnchor);
    d.setDate(weekAnchor.getDate() + i);
    return d;
  });
  const weekDateStrs = weekDays.map(toDateStr);

  const { data: weekAssignments = [], refetch } = useQuery({
    queryKey: ["weekly-assignments", weekDateStrs[0], weekDateStrs[6], effectiveFacilityId ?? "all"],
    queryFn: async () => {
      if (isGlobalView) {
        const results = await Promise.all(
          weekDateStrs.map(date => base44.entities.ShiftAssignment.filter({ date }))
        );
        return results.flat();
      }
      const results = await Promise.all(
        weekDateStrs.map(date => base44.entities.ShiftAssignment.filter({ date, facility_id: effectiveFacilityId }))
      );
      return results.flat();
    },
    enabled: isGlobalView || !!effectiveFacilityId
  });

  const navigateWeek = (dir) => {
    setWeekAnchor(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir * 7);
      return d;
    });
  };

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["weekly-assignments"] });
    qc.invalidateQueries({ queryKey: ["published-assignments"] });
  };

  const handlePublish = async () => {
    if (!isGlobalView && !effectiveFacilityId) return;
    const toPublish = weekAssignments.filter(a => {
      if (a.status === "cancelled" || a.is_published) return false;
      // When in a specific facility tab, only publish that facility's assignments
      if (!isGlobalView && a.facility_id !== effectiveFacilityId) return false;
      return true;
    });
    if (toPublish.length === 0) {
      toast.info("כל המשמרות בסידור זה כבר מפורסמות");
      return;
    }
    await Promise.all(toPublish.map(a => base44.entities.ShiftAssignment.update(a.id, { is_published: true })));
    toast.success(`הסידור פורסם בהצלחה! (${toPublish.length} משמרות) ✅`);
    refreshAll();

    // Send Slack notification to staff
    try {
      const uniqueStaffNames = [...new Set(toPublish.map(a => a.staff_name))];
      const res = await base44.functions.invoke('notifySchedulePublished', {
        week_label: weekLabel,
        facility_name: isGlobalView ? '' : (currentFacility?.name || ''),
        shift_count: toPublish.length,
        staff_names: uniqueStaffNames,
      });
      if (res.data?.success) {
        toast.success('הודעת Slack נשלחה לצוות 📢');
      } else if (res.data?.error) {
        toast.error(`שליחת Slack נכשלה: ${res.data.error}`);
      }
    } catch (err) {
      toast.error('שליחת הודעת Slack נכשלה');
    }
  };

  const handleDragEnd = async (result) => {
    const { destination, draggableId } = result;
    if (!destination || destination.droppableId === "panel") return;

    // droppableId format: "staffId::date"
    const [staffId, date] = destination.droppableId.split("::");
    const templateId = draggableId.replace("tpl-", "");

    const member = staff.find(s => s.id === staffId);
    const template = templates.find(t => t.id === templateId);
    if (!member || !template) return;

    // Role/template compatibility
    if (!(template.applicable_roles || []).includes(member.role)) {
      toast.error(`תבנית "${template.name}" אינה מתאימה ל${member.role === "guard" ? "מאבטח" : "מוקדן"}`, { icon: "🚫" });
      return;
    }

    // Compute times
    const start = new Date(`${date}T${template.start_time}:00`);
    let end = new Date(`${date}T${template.end_time}:00`);
    if (end <= start) end.setDate(end.getDate() + 1);

    // 8-hour rest validation
    const allStaffAssignments = await base44.entities.ShiftAssignment.filter({ staff_id: staffId });
    const restCheck = validateRestPeriod(start.toISOString(), end.toISOString(), allStaffAssignments);
    if (!restCheck.valid) {
      toast.error(restCheck.error, { icon: "⛔", duration: 6000 });
      return;
    }

    // Find matching post (non-blocking — shift is always created even if no post is configured)
    const neededPostType = member.role === "dispatcher" ? "control_room" : "static";
    const memberFacilityPosts = posts.filter(p => p.facility === member.primary_facility && p.status === "active");
    const availablePost = memberFacilityPosts.find(p => p.type === neededPostType && p.required_role === member.role);

    await base44.entities.ShiftAssignment.create({
      staff_id: staffId,
      staff_name: member.full_name,
      shift_template_id: templateId,
      shift_code: template.code,
      post_id: availablePost?.id || "",
      post_name: availablePost?.name || "",
      facility_id: member.primary_facility,
      date,
      actual_start: start.toISOString(),
      actual_end: end.toISOString(),
      status: "scheduled",
      is_emergency_override: false,
      override_reason: "",
      approved_by: ""
    });

    toast.success(`${member.full_name} שובץ למשמרת ${template.code} ✅`);
    refreshAll();
  };

  const weekLabel = `${weekDays[0].getDate()} ${HEB_MONTHS_SHORT[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${HEB_MONTHS_SHORT[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`;

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-screen overflow-hidden" dir="rtl">
        {/* Top Bar */}
        <div className="px-5 pt-4 pb-3 shrink-0 border-b border-border bg-card">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-lg font-bold tracking-tight">ניהול סידור עבודה חכם</h1>
              <p className="text-xs text-muted-foreground">מטריצת שיבוץ שבועית — גרור תבניות משמרת לתוך הטבלה</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Facility Toggle */}
              <div className="flex items-center gap-1 bg-muted border border-border rounded-lg p-0.5">
                {activeFacilities.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFacilityId(f.id)}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-sm font-semibold transition-all",
                      !isGlobalView && effectiveFacilityId === f.id
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f.name}
                  </button>
                ))}
                <button
                  onClick={() => setSelectedFacilityId("all")}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-sm font-semibold transition-all",
                    isGlobalView
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  כלל הצוות
                </button>
              </div>
              {/* Week Navigation */}
              <div className="flex items-center gap-0 bg-card border border-border rounded-lg overflow-hidden">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => navigateWeek(-1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <span className="px-3 text-sm font-semibold select-none min-w-[200px] text-center">{weekLabel}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => navigateWeek(1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setWeekAnchor(getWeekStart(new Date()))}>
                השבוע
              </Button>
              <Button size="sm" className="text-xs h-8 gap-1.5 bg-green-600 hover:bg-green-700" onClick={handlePublish}>
                <Send className="w-3.5 h-3.5" />
                פרסם סידור
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-4 px-6 pb-6 flex-1 overflow-hidden min-h-0">
          <ShiftCardsPanel templates={templates} hasControlRoom={hasControlRoom} />
          <WeeklyMatrix
            weekDays={weekDays}
            hebDays={HEB_DAYS}
            staff={staff}
            effectiveFacilityId={effectiveFacilityId}
            hasControlRoom={hasControlRoom}
            weekAssignments={weekAssignments}
            templates={templates}
            onRefresh={refreshAll}
            isGlobalView={isGlobalView}
          />
        </div>
      </div>
    </DragDropContext>
  );
}