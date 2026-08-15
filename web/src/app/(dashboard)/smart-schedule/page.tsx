"use client";

import ShiftCardsPanel from "@/components/SmartSchedule/ShiftCardsPanel";
import WeeklyMatrix from "@/components/SmartSchedule/WeeklyMatrix";
import { Button } from "@/components/ui/button";
import { notifySchedulePublished } from "@/app/actions/notifications";
import { validateRestPeriod } from "@/lib/shiftValidation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function getWeekStart(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const HEB_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HEB_MONTHS_SHORT = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];

export default function SmartSchedulePage() {
  const qc = useQueryClient();
  const [weekAnchor, setWeekAnchor] = useState(getWeekStart(new Date()));
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);

  const { data: facilities = [] } = useQuery({
    queryKey: ["facilities"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("facilities").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("staff").select("*");
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
  const { data: posts = [] } = useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("posts").select("*");
      if (error) throw error;
      return data;
    },
  });

  const activeFacilities = facilities.filter((f) => f.status !== "inactive");
  const isGlobalView = selectedFacilityId === "all";
  const effectiveFacilityId = isGlobalView ? null : selectedFacilityId || activeFacilities[0]?.id || null;
  const currentFacility = activeFacilities.find((f) => f.id === effectiveFacilityId);

  const facilityPosts = isGlobalView
    ? posts.filter((p) => p.status === "active")
    : posts.filter((p) => p.facility === effectiveFacilityId && p.status === "active");
  const hasControlRoom = isGlobalView
    ? posts.some((p) => p.type === "control_room" && p.status === "active")
    : facilityPosts.some((p) => p.type === "control_room");

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAnchor);
    d.setDate(weekAnchor.getDate() + i);
    return d;
  });
  const weekDateStrs = weekDays.map(toDateStr);

  const { data: weekAssignments = [] } = useQuery({
    queryKey: ["weekly-assignments", weekDateStrs[0], weekDateStrs[6], effectiveFacilityId ?? "all"],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from("shift_assignments")
        .select("*")
        .gte("date", weekDateStrs[0])
        .lte("date", weekDateStrs[6]);
      if (!isGlobalView && effectiveFacilityId) {
        query = query.eq("facility_id", effectiveFacilityId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: isGlobalView || !!effectiveFacilityId,
  });

  const navigateWeek = (dir: number) => {
    setWeekAnchor((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir * 7);
      return d;
    });
  };

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["weekly-assignments"] });
    qc.invalidateQueries({ queryKey: ["published-assignments"] });
  };

  const weekLabel = `${weekDays[0].getDate()} ${HEB_MONTHS_SHORT[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${HEB_MONTHS_SHORT[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`;

  const handlePublish = async () => {
    if (!isGlobalView && !effectiveFacilityId) return;
    const toPublish = weekAssignments.filter((a) => {
      if (a.status === "cancelled" || a.is_published) return false;
      if (!isGlobalView && a.facility_id !== effectiveFacilityId) return false;
      return true;
    });
    if (toPublish.length === 0) {
      toast.info("כל המשמרות בסידור זה כבר מפורסמות");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("shift_assignments")
      .update({ is_published: true })
      .in(
        "id",
        toPublish.map((a) => a.id),
      );
    if (error) {
      toast.error("שגיאה בפרסום הסידור");
      return;
    }

    toast.success(`הסידור פורסם בהצלחה! (${toPublish.length} משמרות) ✅`);
    refreshAll();

    const uniqueStaffNames = [...new Set(toPublish.map((a) => a.staff_name))];
    notifySchedulePublished({
      weekLabel,
      facilityName: isGlobalView ? undefined : currentFacility?.name,
      shiftCount: toPublish.length,
      staffNames: uniqueStaffNames,
    })
      .then(() => toast.success("הודעת Slack נשלחה לצוות 📢"))
      .catch(() => toast.error("שליחת הודעת Slack נכשלה"));
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination || destination.droppableId === "panel") return;

    const [staffId, date] = destination.droppableId.split("::");
    const templateId = draggableId.replace("tpl-", "");

    const member = staff.find((s) => s.id === staffId);
    const template = templates.find((t) => t.id === templateId);
    if (!member || !template) return;

    if (!(template.applicable_roles || []).includes(member.role)) {
      toast.error(`תבנית "${template.name}" אינה מתאימה ל${member.role === "guard" ? "מאבטח" : "מוקדן"}`);
      return;
    }

    const start = new Date(`${date}T${template.start_time}`);
    const end = new Date(`${date}T${template.end_time}`);
    if (end <= start) end.setDate(end.getDate() + 1);

    const supabase = createClient();
    const { data: allStaffAssignments = [] } = await supabase
      .from("shift_assignments")
      .select("*")
      .eq("staff_id", staffId);

    const restCheck = validateRestPeriod(start.toISOString(), end.toISOString(), allStaffAssignments || []);
    if (!restCheck.valid) {
      toast.error(restCheck.error, { duration: 6000 });
      return;
    }

    const neededPostType = member.role === "dispatcher" ? "control_room" : "static";
    const memberFacilityPosts = posts.filter((p) => p.facility === member.primary_facility && p.status === "active");
    const availablePost = memberFacilityPosts.find((p) => p.type === neededPostType && p.required_role === member.role);

    // Unlike the old Base44 app, post_id is a required (not-null) FK here -
    // a shift can't be created without a matching post configured for the
    // facility/role. Surface that as a clear error instead of silently
    // skipping the post assignment.
    if (!availablePost) {
      toast.error(`אין עמדה פנויה מסוג ${neededPostType === "control_room" ? "חדר מוקד" : "עמדה סטטית"} במתקן של ${member.full_name}. הגדר עמדה בעמוד העמדות תחילה.`);
      return;
    }

    const { error } = await supabase.from("shift_assignments").insert({
      staff_id: staffId,
      staff_name: member.full_name,
      shift_template_id: templateId,
      shift_code: template.code,
      post_id: availablePost.id,
      post_name: availablePost.name,
      facility_id: member.primary_facility,
      date,
      actual_start: start.toISOString(),
      actual_end: end.toISOString(),
      status: "scheduled",
      is_emergency_override: false,
    });

    if (error) {
      toast.error("שגיאה בשיבוץ המשמרת");
      return;
    }

    toast.success(`${member.full_name} שובץ למשמרת ${template.code} ✅`);
    refreshAll();
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-screen overflow-hidden" dir="rtl">
        <div className="px-5 pt-4 pb-3 shrink-0 border-b border-border bg-card">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-lg font-bold tracking-tight">ניהול סידור עבודה חכם</h1>
              <p className="text-xs text-muted-foreground">מטריצת שיבוץ שבועית — גרור תבניות משמרת לתוך הטבלה</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 bg-muted border border-border rounded-lg p-0.5">
                {activeFacilities.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFacilityId(f.id)}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-sm font-semibold transition-all",
                      !isGlobalView && effectiveFacilityId === f.id
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f.name}
                  </button>
                ))}
                <button
                  onClick={() => setSelectedFacilityId("all")}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-sm font-semibold transition-all",
                    isGlobalView ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  כלל הצוות
                </button>
              </div>
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
