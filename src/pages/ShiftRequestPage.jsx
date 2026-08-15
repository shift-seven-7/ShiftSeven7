import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Send, Lock, CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useImpersonation } from "@/lib/ImpersonationContext";

const HEB_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HEB_MONTHS_SHORT = ["ינו","פבר","מרץ","אפר","מאי","יוני","יולי","אוג","ספט","אוק","נוב","דצמ"];

const CATEGORY_COLORS = {
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

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ShiftRequestPage() {
  const qc = useQueryClient();
  const { effectiveStaff: myStaff } = useImpersonation();
  const [selectedDay, setSelectedDay] = useState(null); // date string for template picker
  const [submitting, setSubmitting] = useState(false);

  const { data: templates = [] } = useQuery({ queryKey: ["templates"], queryFn: () => base44.entities.ShiftTemplate.list() });

  const weekStart = getNextWeekStart();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const weekDateStrs = weekDays.map(toDateStr);
  const weekLabel = `${weekDays[0].getDate()} ${HEB_MONTHS_SHORT[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${HEB_MONTHS_SHORT[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`;

  const { data: existingRequests = [], refetch } = useQuery({
    queryKey: ["shift-requests-mine", myStaff?.id, weekDateStrs[0]],
    queryFn: () => base44.entities.ShiftRequest.filter({ staff_id: myStaff.id, week_start: weekDateStrs[0] }),
    enabled: !!myStaff?.id,
  });

  const requestMap = useMemo(() => {
    const m = {};
    existingRequests.forEach(r => { m[r.date] = r; });
    return m;
  }, [existingRequests]);

  const deadlinePassed = false;
  const allSubmitted = existingRequests.length > 0 && existingRequests.every(r => r.status === "submitted");

  const availableTemplates = useMemo(() => {
    if (!myStaff) return templates;
    return templates.filter(t => (t.applicable_roles || []).includes(myStaff.role));
  }, [templates, myStaff]);

  const handleSelectTemplate = async (date, template) => {
    if (deadlinePassed || !myStaff) return;
    const existing = requestMap[date];
    if (existing) {
      if (existing.shift_template_id === template.id) {
        await base44.entities.ShiftRequest.delete(existing.id);
      } else {
        await base44.entities.ShiftRequest.update(existing.id, {
          shift_template_id: template.id,
          shift_code: template.code,
          status: existing.status,
        });
      }
    } else {
      await base44.entities.ShiftRequest.create({
        staff_id: myStaff.id,
        staff_name: myStaff.full_name,
        facility_id: myStaff?.primary_facility || "",
        week_start: weekDateStrs[0],
        date,
        shift_template_id: template.id,
        shift_code: template.code,
        status: "draft",
      });
    }
    setSelectedDay(null);
    refetch();
  };

  const handleClearDay = async (date) => {
    const existing = requestMap[date];
    if (existing) {
      await base44.entities.ShiftRequest.delete(existing.id);
      refetch();
    }
  };

  const handleSubmit = async () => {
    if (existingRequests.length === 0) {
      toast.info("אין בקשות שמורות להגשה");
      return;
    }
    setSubmitting(true);
    const drafts = existingRequests.filter(r => r.status === "draft");
    await Promise.all(drafts.map(r => base44.entities.ShiftRequest.update(r.id, { status: "submitted" })));
    toast.success("הבקשות נשלחו להנהלה בהצלחה ✅");
    setSubmitting(false);
    qc.invalidateQueries({ queryKey: ["shift-requests-mine"] });
    refetch();
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card border-b border-border px-5 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold">הגשת אילוצים</h1>
              <p className="text-[11px] text-muted-foreground">שבוע {weekLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {deadlinePassed ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-semibold">
                <Lock className="w-3.5 h-3.5" />
                מועד הגשת הבקשות הסתיים
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {allSubmitted && existingRequests.length > 0 && (
                  <span className="text-[11px] text-green-700 font-semibold">✅ נשלח להנהלה</span>
                )}
                <Button
                  size="sm"
                  className="text-xs h-8 gap-1.5 bg-green-600 hover:bg-green-700"
                  onClick={handleSubmit}
                  disabled={submitting || existingRequests.filter(r => r.status === "draft").length === 0}
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? "שולח..." : "שלח בקשות"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        {deadlinePassed && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
            <Lock className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">מועד הגשת הבקשות הסתיים</p>
              <p className="text-xs opacity-75 mt-0.5">ניתן להגיש בקשות עד יום שני 23:59 של השבוע הנוכחי</p>
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground mb-4">
          לחץ על יום כדי לבחור משמרת מבוקשת. ניתן לסמן עד משמרת אחת ליום.
        </p>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((d, i) => {
            const dateStr = weekDateStrs[i];
            const req = requestMap[dateStr];
            const tpl = req ? templates.find(t => t.id === req.shift_template_id) : null;
            const colors = tpl ? CATEGORY_COLORS[tpl.category] : null;
            const isOpen = selectedDay === dateStr;

            return (
              <div key={dateStr} className="flex flex-col gap-1">
                {/* Day header */}
                <div className="text-center py-2 rounded-lg bg-muted/60 border border-border">
                  <p className="text-xs font-bold text-muted-foreground">{HEB_DAYS[d.getDay()]}</p>
                  <p className="text-sm font-semibold">{d.getDate()}/{d.getMonth() + 1}</p>
                </div>

                {/* Cell */}
                <div
                  className={cn(
                    "relative rounded-lg border-2 min-h-[80px] cursor-pointer transition-all",
                    deadlinePassed ? "cursor-default opacity-70" : "hover:border-primary/50",
                    isOpen ? "border-primary shadow-md" : "border-dashed border-border",
                  )}
                  style={colors ? { background: colors.bg, borderColor: colors.border, borderStyle: "solid" } : {}}
                  onClick={() => {
                    if (deadlinePassed) return;
                    setSelectedDay(isOpen ? null : dateStr);
                  }}
                >
                  {req && tpl ? (
                    <div className="p-2 flex flex-col items-center justify-center h-full gap-0.5">
                      <span className="font-black text-lg leading-none" style={{ color: colors?.text }}>{tpl.code}</span>
                      <span className="text-[10px] font-semibold opacity-80" style={{ color: colors?.text }}>{tpl.name}</span>
                      {req.status === "submitted" && (
                        <span className="text-[9px] bg-green-100 text-green-700 rounded px-1 mt-0.5">נשלח ✓</span>
                      )}
                      {!deadlinePassed && (
                        <button
                          onClick={e => { e.stopPropagation(); handleClearDay(dateStr); }}
                          className="absolute top-1 left-1 w-4 h-4 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground/50 select-none">
                      {!deadlinePassed ? "+ בחר" : "—"}
                    </div>
                  )}
                </div>

                {/* Template picker dropdown */}
                {isOpen && (
                  <div className="absolute z-30 mt-1 w-44 bg-card border border-border rounded-xl shadow-xl p-1.5 space-y-1"
                    style={{ position: "relative" }}>
                    {availableTemplates.length === 0 && (
                      <p className="text-xs text-muted-foreground p-2">אין תבניות זמינות</p>
                    )}
                    {availableTemplates.map(t => {
                      const c = CATEGORY_COLORS[t.category];
                      const isSelected = req?.shift_template_id === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => handleSelectTemplate(dateStr, t)}
                          className={cn(
                            "w-full text-right px-2 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2",
                            isSelected ? "ring-2 ring-primary" : "hover:bg-muted"
                          )}
                          style={{ background: c?.bg, color: c?.text }}
                        >
                          <span className="font-black text-sm">{t.code}</span>
                          <span className="truncate">{t.name}</span>
                          {t.start_time && <span className="opacity-60 mr-auto shrink-0">{t.start_time}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-muted/40 rounded-xl border border-border text-xs text-muted-foreground">
          <p className="font-semibold mb-1">הנחיות:</p>
          <ul className="space-y-0.5 list-disc list-inside">
            <li>לחץ על יום כדי לבחור משמרת מבוקשת מהרשימה</li>
            <li>ניתן להגיש בקשות בכל עת, ללא מועד אחרון</li>
            <li>לחיצה על "שלח בקשות" תעביר את הבקשות לאישור ההנהלה</li>
            <li>לאחר שליחה, ניתן להמשיך לערוך — השינויים מתעדכנים אצל ההנהלה אוטומטית</li>
          </ul>
        </div>
      </div>
    </div>
  );
}