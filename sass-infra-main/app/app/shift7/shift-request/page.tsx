'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMyShift7Staff } from '@/hooks/queries/useMyShift7Staff';
import { useShift7ShiftTemplates } from '@/hooks/queries/useShift7ShiftTemplates';
import {
  useDeleteShift7Request,
  useSelectShift7Request,
  useShift7ShiftRequests,
  useSubmitShift7Requests,
} from '@/hooks/queries/useShift7ShiftRequests';
import type { ShiftTemplateRow } from '@/types/database.types';

const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEB_MONTHS_SHORT = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יוני', 'יולי', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  morning: { bg: '#FEF9C3', border: '#FDE047', text: '#713F12' },
  afternoon: { bg: '#DBEAFE', border: '#60A5FA', text: '#1E3A8A' },
  night: { bg: '#EDE9FE', border: '#A78BFA', text: '#4C1D95' },
};

function getNextWeekStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 7);
  d.setHours(0, 0, 0, 0);
  return d;
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Shift7ShiftRequestPage() {
  const { data: myStaff } = useMyShift7Staff();
  const { data: templates = [] } = useShift7ShiftTemplates();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const weekStart = useMemo(getNextWeekStart, []);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86_400_000)),
    [weekStart]
  );
  const weekDateStrs = useMemo(() => weekDays.map(toDateStr), [weekDays]);
  const weekLabel = `${weekDays[0].getDate()} ${HEB_MONTHS_SHORT[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${HEB_MONTHS_SHORT[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`;

  const { data: existingRequests = [] } = useShift7ShiftRequests(weekDateStrs[0]);
  const select = useSelectShift7Request();
  const remove = useDeleteShift7Request();
  const submit = useSubmitShift7Requests();

  const requestMap = useMemo(() => {
    const map: Record<string, (typeof existingRequests)[number]> = {};
    for (const r of existingRequests) map[r.date] = r;
    return map;
  }, [existingRequests]);

  const allSubmitted = existingRequests.length > 0 && existingRequests.every((r) => r.status === 'submitted');
  const draftCount = existingRequests.filter((r) => r.status === 'draft').length;

  const availableTemplates: ShiftTemplateRow[] = useMemo(() => {
    if (!myStaff) return templates;
    return templates.filter((t) => t.applicable_roles.includes(myStaff.role));
  }, [templates, myStaff]);

  async function handleSelectTemplate(date: string, template: ShiftTemplateRow) {
    const existing = requestMap[date];
    try {
      if (existing?.shift_template_id === template.id) {
        await remove.mutateAsync(existing.id);
      } else {
        await select.mutateAsync({
          week_start: weekDateStrs[0],
          date,
          shift_template_id: template.id,
          shift_code: template.code,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בשמירה');
    }
    setSelectedDay(null);
  }

  async function handleClearDay(date: string) {
    const existing = requestMap[date];
    if (!existing) return;
    try {
      await remove.mutateAsync(existing.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה במחיקה');
    }
  }

  async function handleSubmit() {
    if (draftCount === 0) {
      toast.info('אין בקשות שמורות להגשה');
      return;
    }
    try {
      await submit.mutateAsync(weekDateStrs[0]);
      toast.success('הבקשות נשלחו להנהלה בהצלחה');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בשליחה');
    }
  }

  if (!myStaff) {
    return (
      <PageLayout title="הגשת אילוצים">
        <p className="py-16 text-center text-sm text-muted-foreground">אין לך רשומת עובד משויכת במערכת. פנה למנהל המערכת.</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="הגשת אילוצים"
      subtitle={`שבוע ${weekLabel}`}
      actions={
        <Button
          size="sm"
          className="gap-1.5 bg-green-600 hover:bg-green-700"
          onClick={handleSubmit}
          disabled={submit.isPending || draftCount === 0}
        >
          <Send className="h-3.5 w-3.5" />
          {submit.isPending ? 'שולח...' : 'שלח בקשות'}
        </Button>
      }
    >
      {allSubmitted && existingRequests.length > 0 && (
        <p className="mb-3 text-xs font-semibold text-green-700">נשלח להנהלה</p>
      )}
      <p className="mb-4 text-sm text-muted-foreground">לחץ על יום כדי לבחור משמרת מבוקשת. ניתן לסמן עד משמרת אחת ליום.</p>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((d, i) => {
          const dateStr = weekDateStrs[i];
          const req = requestMap[dateStr];
          const tpl = req ? templates.find((t) => t.id === req.shift_template_id) : null;
          const colors = tpl ? CATEGORY_COLORS[tpl.category] : null;
          const isOpen = selectedDay === dateStr;

          return (
            <div key={dateStr} className="relative flex flex-col gap-1">
              <div className="rounded-lg border border-border bg-muted/60 py-2 text-center">
                <p className="text-xs font-bold text-muted-foreground">{HEB_DAYS[d.getDay()]}</p>
                <p className="text-sm font-semibold">
                  {d.getDate()}/{d.getMonth() + 1}
                </p>
              </div>

              <div
                className={cn(
                  'relative min-h-[80px] cursor-pointer rounded-lg border-2 transition-all',
                  isOpen ? 'border-primary shadow-md' : 'border-dashed border-border hover:border-primary/50'
                )}
                style={colors ? { background: colors.bg, borderColor: colors.border, borderStyle: 'solid' } : {}}
                onClick={() => setSelectedDay(isOpen ? null : dateStr)}
              >
                {req && tpl ? (
                  <div className="flex h-full flex-col items-center justify-center gap-0.5 p-2">
                    <span className="text-lg font-black leading-none" style={{ color: colors?.text }}>
                      {tpl.code}
                    </span>
                    <span className="text-[10px] font-semibold opacity-80" style={{ color: colors?.text }}>
                      {tpl.name}
                    </span>
                    {req.status === 'submitted' && (
                      <span className="mt-0.5 rounded bg-green-100 px-1 text-[9px] text-green-700">נשלח</span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearDay(dateStr);
                      }}
                      className="absolute start-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/10 hover:bg-black/20"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-full select-none items-center justify-center text-xs text-muted-foreground/50">
                    + בחר
                  </div>
                )}
              </div>

              {isOpen && (
                <div className="absolute top-full z-30 mt-1 w-44 space-y-1 rounded-xl border border-border bg-card p-1.5 shadow-xl">
                  {availableTemplates.length === 0 && <p className="p-2 text-xs text-muted-foreground">אין תבניות זמינות</p>}
                  {availableTemplates.map((t) => {
                    const c = CATEGORY_COLORS[t.category];
                    const isSelected = req?.shift_template_id === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => handleSelectTemplate(dateStr, t)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-xs font-semibold transition-all',
                          isSelected ? 'ring-2 ring-primary' : 'hover:bg-muted'
                        )}
                        style={{ background: c?.bg, color: c?.text }}
                      >
                        <span className="text-sm font-black">{t.code}</span>
                        <span className="truncate">{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
        <CalendarDays className="h-4 w-4 shrink-0" />
        <span>ניתן להגיש בקשות בכל עת. לחיצה על &quot;שלח בקשות&quot; מעבירה אותן לאישור ההנהלה.</span>
      </div>
    </PageLayout>
  );
}
