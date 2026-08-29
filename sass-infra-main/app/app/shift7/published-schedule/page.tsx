'use client';

import { useMemo, useState } from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useShift7Facilities } from '@/hooks/queries/useShift7Facilities';
import { useShift7Staff } from '@/hooks/queries/useShift7Staff';
import { useMyShift7Staff } from '@/hooks/queries/useMyShift7Staff';
import { useShift7ShiftTemplates } from '@/hooks/queries/useShift7ShiftTemplates';
import { useShift7ShiftAssignments } from '@/hooks/queries/useShift7ShiftAssignments';
import { exportSchedulePDF, exportScheduleCSV } from '@/lib/shift7/exportSchedule';

const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEB_MONTHS_SHORT = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יוני', 'יולי', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function isDark(hex: string | null | undefined): boolean {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

/** 'mine' | a facility id | 'all' (every facility). */
type ViewMode = 'mine' | 'all' | string;

/**
 * Read-only, published-only view of the schedule — an admin/scheduler reaches
 * it from the module nav, a plain employee lands here directly (see
 * layout.tsx's EMPLOYEE_NAV). RLS already limits an employee's own read to
 * their own published rows, so the "mine" tab and CSV/PDF exports work
 * identically for every role without any client-side role branching.
 */
export default function Shift7PublishedSchedulePage() {
  const [weekAnchor, setWeekAnchor] = useState(() => getWeekStart(new Date()));
  const [viewMode, setViewMode] = useState<ViewMode>('mine');
  const [exporting, setExporting] = useState(false);

  const { data: myStaff } = useMyShift7Staff();
  const { data: facilities = [] } = useShift7Facilities();
  const { data: staffData = [] } = useShift7Staff();
  const { data: templates = [] } = useShift7ShiftTemplates();

  const activeFacilities = facilities.filter((f) => f.status !== 'inactive');

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

  const isMine = viewMode === 'mine';
  const isAll = viewMode === 'all';
  const facilityId = !isMine && !isAll ? viewMode : undefined;

  const { data: assignments = [], isPending } = useShift7ShiftAssignments(
    weekDateStrs[0],
    weekDateStrs[6],
    isMine || isAll ? undefined : facilityId,
    isMine ? myStaff?.id : undefined
  );

  const active = assignments.filter((a) => a.status !== 'cancelled' && a.is_published);

  const handleExportPDF = async () => {
    if (active.length === 0) return;
    setExporting(true);
    try {
      await exportSchedulePDF({
        assignments: active,
        templates,
        staffData,
        weekLabel,
        facilityName: isAll || isMine ? undefined : activeFacilities.find((f) => f.id === facilityId)?.name,
      });
    } finally {
      setExporting(false);
    }
  };

  const staffList = useMemo(() => {
    const map: Record<string, string> = {};
    active.forEach((a) => {
      const live = staffData.find((x) => x.id === a.staff_id);
      map[a.staff_id] = live?.full_name || a.staff_name;
    });
    let entries = Object.entries(map);
    if (isMine && myStaff) {
      entries = entries.filter(([sid]) => sid === myStaff.id);
    }
    const rankOf = (sid: string) => {
      const s = staffData.find((x) => x.id === sid);
      if (!s) return 99;
      if (s.role === 'guard' && s.qualification === 'shift_supervisor') return 0;
      if (s.role === 'guard') return 1;
      if (s.role === 'dispatcher' && s.qualification === 'lead_dispatcher') return 2;
      if (s.role === 'dispatcher') return 3;
      return 4;
    };
    entries.sort((a, b) => rankOf(a[0]) - rankOf(b[0]) || a[1].localeCompare(b[1], 'he'));
    return entries;
  }, [active, isMine, myStaff, staffData]);

  const cellMap = useMemo(() => {
    const m: Record<string, (typeof active)[number]> = {};
    active.forEach((a) => {
      m[`${a.staff_id}::${a.date}`] = a;
    });
    return m;
  }, [active]);

  return (
    <PageLayout
      title="סידור עבודה סופי"
      subtitle="משמרות מפורסמות בלבד — לקריאה בלבד"
      fullWidth
      actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={handleExportPDF}
            disabled={exporting || active.length === 0}
          >
            {exporting ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            {exporting ? 'מייצר...' : 'ייצא PDF'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            disabled={active.length === 0}
            onClick={() => exportScheduleCSV(active, templates, facilities, facilityId, staffData)}
          >
            <Download className="h-3.5 w-3.5" />
            ייצא לאקסל
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center overflow-hidden rounded-lg border border-border bg-card">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-muted"
            onClick={() => navigateWeek(-1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="min-w-[180px] select-none px-3 text-center text-xs font-semibold">{weekLabel}</span>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-muted"
            onClick={() => navigateWeek(1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setWeekAnchor(getWeekStart(new Date()))}
          className="h-8 rounded-lg border border-border bg-card px-3 text-xs font-semibold transition-colors hover:bg-muted"
        >
          השבוע הנוכחי
        </button>
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted p-0.5">
          {myStaff && (
            <button
              type="button"
              onClick={() => setViewMode('mine')}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-semibold transition-all',
                isMine ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              המשמרות שלי
            </button>
          )}
          {activeFacilities.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setViewMode(f.id)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-semibold transition-all',
                viewMode === f.id ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-semibold transition-all',
              isAll ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            כלל הצוות
          </button>
        </div>
      </div>

      {isPending && (
        <div className="flex justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-border border-t-primary" />
        </div>
      )}

      {!isPending && staffList.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <CalendarCheck className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="font-semibold text-muted-foreground">אין סידור מפורסם</p>
          <p className="mt-1 text-sm text-muted-foreground/60">הסידור יופיע כאן לאחר שהמנהל יפרסם אותו</p>
        </div>
      )}

      {!isPending && staffList.length > 0 && (
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse" style={{ borderSpacing: 0, tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th
                  className="sticky right-0 z-10 whitespace-nowrap border border-border px-3 py-2 text-right text-xs font-bold text-white"
                  style={{ width: 140, background: '#1f2937' }}
                >
                  שם עובד
                </th>
                {weekDateStrs.map((date) => {
                  const d = new Date(date + 'T12:00:00');
                  return (
                    <th
                      key={date}
                      className="border border-border px-2 py-2 text-center text-xs font-bold text-white"
                      style={{ background: '#1f2937' }}
                    >
                      <div>{HEB_DAYS[d.getDay()]}</div>
                      <div className="text-[10px] font-normal opacity-70">
                        {d.getDate()}/{d.getMonth() + 1}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {staffList.map(([staffId, staffName], ri) => (
                <tr key={staffId}>
                  <td
                    className="sticky right-0 z-10 whitespace-nowrap border border-border/60 px-3 py-2 text-right text-xs font-semibold"
                    style={{ background: ri % 2 === 0 ? '#f3f4f6' : '#e9eaec', width: 140, color: '#111' }}
                  >
                    {staffName}
                  </td>
                  {weekDateStrs.map((date) => {
                    const a = cellMap[`${staffId}::${date}`];
                    const tpl = a ? templates.find((t) => t.id === a.shift_template_id) : null;
                    const color = tpl?.color || null;
                    const dark = isDark(color);
                    return (
                      <td
                        key={date}
                        className="border border-border/60 p-1 text-center text-xs"
                        style={{ background: color || (ri % 2 === 0 ? '#ffffff' : '#f9fafb') }}
                      >
                        {a && tpl && (
                          <div className="flex flex-col items-center justify-center gap-0.5 leading-tight">
                            <span
                              className="text-sm font-black leading-none"
                              style={{ color: dark ? '#fff' : '#111' }}
                            >
                              {a.shift_code}
                            </span>
                            {tpl.post_number && (
                              <span
                                className="text-[10px] font-semibold opacity-80"
                                style={{ color: dark ? '#ffffffcc' : '#333' }}
                              >
                                ע׳{tpl.post_number}
                              </span>
                            )}
                            <span className="text-[9px] opacity-60" style={{ color: dark ? '#ffffffaa' : '#555' }}>
                              {formatTime(a.actual_start)}
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageLayout>
  );
}
