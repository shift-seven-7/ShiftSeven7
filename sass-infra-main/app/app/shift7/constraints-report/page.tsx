'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileWarning } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageLayout } from '@/components/layout/PageLayout';
import { useShift7Facilities } from '@/hooks/queries/useShift7Facilities';
import { useShift7ShiftTemplates } from '@/hooks/queries/useShift7ShiftTemplates';
import { useAllShift7ShiftRequests } from '@/hooks/queries/useShift7ShiftRequests';
import { useShift7ShiftAssignments } from '@/hooks/queries/useShift7ShiftAssignments';
import type { ShiftAssignmentRow, ShiftRequestRow } from '@/types/database.types';

const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEB_MONTHS_SHORT = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יוני', 'יולי', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

type ReportStatus = 'fulfilled' | 'conflict' | 'pending';

const STATUS_META: Record<ReportStatus, { label: string; color: string; dot: string }> = {
  fulfilled: { label: 'מאויש כמבוקש', color: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400', dot: 'bg-green-500' },
  conflict: { label: 'מתנגש עם השיבוץ', color: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400', dot: 'bg-red-500' },
  pending: { label: 'ממתין לשיבוץ', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400', dot: 'bg-amber-500' },
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** shift_templates.start_time/end_time are plain 'HH:MM:SS' TIME values. */
function formatTimeOfDay(time: string | undefined): string {
  if (!time) return '';
  return time.slice(0, 5);
}

/** shift_assignments.actual_start/actual_end are UTC timestamps — go through Date to render in local time. */
function formatIsoTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: typeof FileWarning;
  label: string;
  value: number;
  sublabel?: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold leading-tight">{value}</p>
        {sublabel && <p className="mt-0.5 text-[10px] text-muted-foreground">{sublabel}</p>}
      </div>
    </div>
  );
}

/** Cross-references submitted shift_requests against actual shift_assignments — admin/scheduler only. */
export default function Shift7ConstraintsReportPage() {
  const [weekAnchor, setWeekAnchor] = useState(() => getWeekStart(new Date()));
  const [facilityFilter, setFacilityFilter] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<'all' | ReportStatus>('all');

  const { data: facilities = [] } = useShift7Facilities();
  const { data: templates = [] } = useShift7ShiftTemplates();

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

  const facilityId = facilityFilter === 'all' ? undefined : facilityFilter;

  const { data: allRequests = [], isPending } = useAllShift7ShiftRequests(weekStart, facilityId);
  const requests = allRequests.filter((r) => r.status === 'submitted');

  const { data: assignments = [] } = useShift7ShiftAssignments(weekDateStrs[0], weekDateStrs[6], facilityId);

  const assignmentMap = useMemo(() => {
    const m: Record<string, ShiftAssignmentRow> = {};
    assignments
      .filter((a) => a.status !== 'cancelled')
      .forEach((a) => {
        m[`${a.staff_id}::${a.date}`] = a;
      });
    return m;
  }, [assignments]);

  const enriched = useMemo(() => {
    return requests.map((r) => {
      const assignment = assignmentMap[`${r.staff_id}::${r.date}`];
      let status: ReportStatus = 'pending';
      if (assignment) {
        status = assignment.shift_template_id === r.shift_template_id ? 'fulfilled' : 'conflict';
      }
      return { request: r, status, assignment };
    });
  }, [requests, assignmentMap]);

  const counts = useMemo(
    () => ({
      total: enriched.length,
      fulfilled: enriched.filter((e) => e.status === 'fulfilled').length,
      conflict: enriched.filter((e) => e.status === 'conflict').length,
      pending: enriched.filter((e) => e.status === 'pending').length,
    }),
    [enriched]
  );

  const filtered = useMemo(() => {
    const list = filterMode === 'all' ? enriched : enriched.filter((e) => e.status === filterMode);
    return [...list].sort(
      (a, b) =>
        (a.request.staff_name || '').localeCompare(b.request.staff_name || '') ||
        a.request.date.localeCompare(b.request.date)
    );
  }, [enriched, filterMode]);

  const tplOf = (r: ShiftRequestRow) => templates.find((t) => t.id === r.shift_template_id);
  const fmtDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return `${HEB_DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <PageLayout
      title="דוח אילוצים"
      subtitle="מרכוז בקשות עובדים וזיהוי התנגשויות עם השיבוץ בפועל"
      fullWidth
    >
      <div className="mb-6 flex items-center justify-end gap-2">
        <div className="flex items-center overflow-hidden rounded-lg border border-border bg-card">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-muted"
            onClick={() => navigateWeek(-1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="min-w-[160px] select-none px-3 text-center text-xs font-semibold">{weekLabel}</span>
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
          השבוע
        </button>
      </div>

      <div className="mb-5 flex w-fit gap-1 rounded-lg border border-border bg-muted p-0.5">
        <button
          type="button"
          onClick={() => setFacilityFilter('all')}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
            facilityFilter === 'all' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          כל המתקנים
        </button>
        {facilities
          .filter((f) => f.status !== 'inactive')
          .map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFacilityFilter(f.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
                facilityFilter === f.id ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f.name}
            </button>
          ))}
      </div>

      {!isPending && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={CalendarDays} label="סה״כ בקשות" value={counts.total} sublabel="בקשות שהוגשו" color="bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400" />
          <StatCard icon={CheckCircle2} label="מאויש כמבוקש" value={counts.fulfilled} sublabel="הבקשה כובדה" color="bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400" />
          <StatCard
            icon={AlertTriangle}
            label="מתנגשים"
            value={counts.conflict}
            sublabel={counts.conflict > 0 ? 'דורש טיפול' : 'אין התנגשויות'}
            color={counts.conflict > 0 ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400'}
          />
          <StatCard icon={Clock} label="ממתינות לשיבוץ" value={counts.pending} sublabel="טרם שובצו" color="bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400" />
        </div>
      )}

      <div className="mb-3 flex w-fit items-center gap-1 rounded-lg border border-border bg-muted p-0.5">
        {(
          [
            { key: 'all', label: `הכל (${counts.total})` },
            { key: 'conflict', label: `מתנגשים (${counts.conflict})` },
            { key: 'pending', label: `ממתינות (${counts.pending})` },
            { key: 'fulfilled', label: `מאוישות (${counts.fulfilled})` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilterMode(t.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
              filterMode === t.key ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isPending ? (
        <div className="flex justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-border border-t-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileWarning className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-semibold text-muted-foreground">
            {counts.total === 0 ? 'אין בקשות שהוגשו לשבוע זה' : 'אין בקשות בסינון זה'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">עובד</th>
                <th className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">תאריך</th>
                <th className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">משמרת מבוקשת</th>
                <th className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">שובץ בפועל</th>
                <th className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ request: r, status, assignment }) => {
                const reqTpl = tplOf(r);
                const meta = STATUS_META[status];
                return (
                  <tr
                    key={r.id}
                    className={cn(
                      'border-b border-border/50',
                      status === 'conflict'
                        ? 'bg-red-50/40 dark:bg-red-950/10'
                        : status === 'fulfilled'
                          ? 'bg-green-50/30 dark:bg-green-950/10'
                          : 'hover:bg-muted/20'
                    )}
                  >
                    <td className="px-3 py-2.5 font-medium">{r.staff_name}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{fmtDate(r.date)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-bold">{r.shift_code}</span>
                        {reqTpl && (
                          <span className="text-xs text-muted-foreground">
                            {formatTimeOfDay(reqTpl.start_time)}–{formatTimeOfDay(reqTpl.end_time)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {assignment ? (
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-bold">{assignment.shift_code}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatIsoTime(assignment.actual_start)}–{formatIsoTime(assignment.actual_end)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">— טרם שובץ</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold', meta.color)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
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
    </PageLayout>
  );
}
