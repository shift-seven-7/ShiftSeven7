'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CalendarX, CheckCircle2, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageLayout } from '@/components/layout/PageLayout';
import { useShift7Facilities } from '@/hooks/queries/useShift7Facilities';
import { useShift7Staff } from '@/hooks/queries/useShift7Staff';
import { useShift7ShiftTemplates } from '@/hooks/queries/useShift7ShiftTemplates';
import { useShift7StaffingRequirements } from '@/hooks/queries/useShift7StaffingRequirements';
import { useShift7ShiftAssignments } from '@/hooks/queries/useShift7ShiftAssignments';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CAPABILITY_LABELS,
  buildRequirementsMap,
  buildPool,
  computeShortage,
  getFacilityRequirementConfig,
  getRequirement,
  shortageText,
  type Category,
  type RequirementCounts,
} from '@/lib/shift7/staffingRequirements';

const HEB_DAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
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

function requirementLabel(req: RequirementCounts | null | undefined): string {
  if (!req) return '';
  return (Object.entries(req) as [keyof RequirementCounts, number | undefined][])
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${CAPABILITY_LABELS[k]} ${v}`)
    .join(' + ');
}

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: typeof Shield;
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

/** Coverage-gap report: weekly shift-category requirement vs. who's actually assigned. */
export default function Shift7UnstaffedShiftsPage() {
  const [weekAnchor, setWeekAnchor] = useState(() => getWeekStart(new Date()));
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [showGapsOnly, setShowGapsOnly] = useState(true);

  const { data: facilities = [] } = useShift7Facilities();
  const { data: templates = [] } = useShift7ShiftTemplates();
  const { data: staff = [] } = useShift7Staff();
  const { data: requirementRecords = [] } = useShift7StaffingRequirements();

  const activeFacilities = facilities.filter((f) => f.status !== 'inactive');
  const effectiveFacilityId = selectedFacilityId || activeFacilities[0]?.id || null;
  const facilityName = activeFacilities.find((f) => f.id === effectiveFacilityId)?.name || '';

  const requirementsMap = useMemo(() => buildRequirementsMap(requirementRecords), [requirementRecords]);
  const facilityHasRequirements = !!getFacilityRequirementConfig(effectiveFacilityId, requirementsMap);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAnchor);
    d.setDate(weekAnchor.getDate() + i);
    return d;
  });
  const weekDateStrs = weekDays.map(toDateStr);
  const weekLabel = `${weekDays[0].getDate()} ${HEB_MONTHS_SHORT[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${HEB_MONTHS_SHORT[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`;
  const todayStr = toDateStr(new Date());

  const navigateWeek = (dir: number) =>
    setWeekAnchor((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir * 7);
      return d;
    });

  const { data: assignments = [], isPending } = useShift7ShiftAssignments(
    weekDateStrs[0],
    weekDateStrs[6],
    effectiveFacilityId ?? undefined
  );

  const templateMap = useMemo(() => {
    const m: Record<string, (typeof templates)[number]> = {};
    templates.forEach((t) => (m[t.id] = t));
    return m;
  }, [templates]);

  const staffMap = useMemo(() => {
    const m: Record<string, (typeof staff)[number]> = {};
    staff.forEach((s) => (m[s.id] = s));
    return m;
  }, [staff]);

  // Assignment pool per (category, date) — how many of each capability are already assigned.
  const poolMap = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    const byKey: Record<string, typeof assignments> = {};
    assignments
      .filter((a) => a.status !== 'cancelled' && a.shift_template_id)
      .forEach((a) => {
        const cat = templateMap[a.shift_template_id]?.category;
        if (!cat) return;
        const key = `${cat}::${a.date}`;
        (byKey[key] ??= []).push(a);
      });
    Object.entries(byKey).forEach(([key, list]) => {
      m[key] = buildPool(list, staffMap);
    });
    return m;
  }, [assignments, templateMap, staffMap]);

  const rows = useMemo(() => {
    const cats = CATEGORY_ORDER.filter((cat) =>
      weekDays.some((d) => getRequirement(effectiveFacilityId, d, cat, requirementsMap))
    );
    return cats.map((cat) => {
      const days = weekDays.map((d) => {
        const date = toDateStr(d);
        const req = getRequirement(effectiveFacilityId, d, cat, requirementsMap);
        if (!req) return { date, hasReq: false as const, req: null, shortage: null };
        const pool = poolMap[`${cat}::${date}`] || {};
        const shortage = computeShortage(req, pool);
        return { date, hasReq: true as const, req, shortage };
      });
      const gapCount = days.filter((d) => d.hasReq && d.shortage!.totalShortage > 0).length;
      return { cat, days, gapCount };
    });
  }, [effectiveFacilityId, weekDays, poolMap, requirementsMap]);

  const visibleRows = showGapsOnly ? rows.filter((r) => r.gapCount > 0) : rows;

  const totalRequiredSlots = rows.reduce(
    (sum, r) => sum + r.days.filter((d) => d.hasReq).reduce((s, d) => s + d.shortage!.totalRequired, 0),
    0
  );
  const totalAssignedSlots = rows.reduce(
    (sum, r) => sum + r.days.filter((d) => d.hasReq).reduce((s, d) => s + d.shortage!.totalAssigned, 0),
    0
  );
  const totalShortage = rows.reduce(
    (sum, r) => sum + r.days.filter((d) => d.hasReq).reduce((s, d) => s + d.shortage!.totalShortage, 0),
    0
  );
  const daysWithGaps = weekDateStrs.filter((date) =>
    rows.some((r) => r.days.find((d) => d.date === date && d.hasReq && d.shortage!.totalShortage > 0))
  ).length;

  return (
    <PageLayout
      title="פערי סידור"
      subtitle="כיסוי משמרות מול תקינת כוח אדם — להשלמה מהירה"
      fullWidth
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
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
        {activeFacilities.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setSelectedFacilityId(f.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
              effectiveFacilityId === f.id ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {f.name}
          </button>
        ))}
      </div>

      {!facilityHasRequirements && !isPending && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Shield className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-semibold text-muted-foreground">אין תקינת כיסוי מוגדרת למתקן {facilityName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            ניתן להגדיר דרישות כיסוי בעמוד{' '}
            <Link href="/app/shift7/staffing-requirements" className="underline">
              תקינת כיסוי
            </Link>
          </p>
        </div>
      )}

      {facilityHasRequirements && !isPending && totalRequiredSlots > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Shield} label="משבצות נדרשות" value={totalRequiredSlots} sublabel={`במתקן ${facilityName}`} color="bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400" />
          <StatCard icon={CheckCircle2} label="משבצות מאוישות" value={totalAssignedSlots} sublabel={`מתוך ${totalRequiredSlots}`} color="bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400" />
          <StatCard icon={CalendarX} label="ימים עם פערים" value={daysWithGaps} sublabel="מתוך 7 ימי השבוע" color="bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400" />
          <StatCard
            icon={AlertCircle}
            label="סה״כ פערים"
            value={totalShortage}
            sublabel="משבצות ללא כיסוי"
            color={totalShortage > 0 ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400'}
          />
        </div>
      )}

      {facilityHasRequirements && rows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg border border-border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setShowGapsOnly(true)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
                showGapsOnly ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              פערים בלבד ({rows.filter((r) => r.gapCount > 0).length})
            </button>
            <button
              type="button"
              onClick={() => setShowGapsOnly(false)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
                !showGapsOnly ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              כל המשמרות ({rows.length})
            </button>
          </div>
          {totalShortage > 0 && (
            <Link
              href="/app/shift7/smart-schedule"
              className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              עבור לסידור החכם להשלמה
            </Link>
          )}
        </div>
      )}

      {isPending ? (
        <div className="flex justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-border border-t-primary" />
        </div>
      ) : facilityHasRequirements && rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="mb-3 h-10 w-10 text-green-500" />
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">אין דרישות כיסוי לשבוע זה</p>
          <p className="mt-1 text-xs text-muted-foreground">במתקן {facilityName}</p>
        </div>
      ) : facilityHasRequirements && visibleRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="mb-3 h-10 w-10 text-green-500" />
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">כל המשמרות מאוישות השבוע!</p>
          <p className="mt-1 text-xs text-muted-foreground">אין פערי סידור במתקן {facilityName}</p>
        </div>
      ) : facilityHasRequirements ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky right-0 bg-background px-3 py-2 text-start text-xs font-medium text-muted-foreground" style={{ minWidth: 200 }}>
                  משמרת
                </th>
                {weekDays.map((d, i) => (
                  <th key={i} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                    <div>{HEB_DAYS_SHORT[i]}</div>
                    <div className="text-[10px] font-normal opacity-60">
                      {d.getDate()}/{d.getMonth() + 1}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(({ cat, days, gapCount }) => (
                <tr key={cat} className={cn('border-b border-border/50', gapCount > 0 ? 'bg-red-50/30 dark:bg-red-950/10' : 'hover:bg-muted/20')}>
                  <td className="sticky right-0 bg-inherit px-3 py-2.5">
                    <div className="font-medium">{CATEGORY_LABELS[cat as Category]}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {requirementLabel(getRequirement(effectiveFacilityId, weekDays[0], cat as Category, requirementsMap))}
                      </span>
                      {gapCount > 0 && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-400">
                          {gapCount} פערים
                        </span>
                      )}
                    </div>
                  </td>
                  {days.map(({ date, hasReq, req, shortage }) => {
                    const isToday = date === todayStr;
                    if (!hasReq) {
                      return (
                        <td key={date} className={cn('border border-border/30 px-1 py-2 text-center', isToday && 'ring-1 ring-primary/30')}>
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted/40 text-xs text-muted-foreground/40">
                            —
                          </span>
                        </td>
                      );
                    }
                    const isGap = shortage!.totalShortage > 0;
                    const title = `נדרש: ${requirementLabel(req)}\nמאויש: ${shortage!.totalAssigned}/${shortage!.totalRequired}\n${isGap ? 'חסר: ' + shortageText(shortage) : 'מלא'}`;
                    return (
                      <td key={date} className={cn('border border-border/30 px-1 py-2 text-center', isToday && 'ring-1 ring-primary/30')}>
                        {isGap ? (
                          <Link
                            href="/app/shift7/smart-schedule"
                            title={title}
                            className="inline-flex h-10 w-12 flex-col items-center justify-center rounded-lg bg-red-100 text-red-700 transition-colors hover:bg-red-200 dark:bg-red-950/50 dark:text-red-400 dark:hover:bg-red-950/70"
                          >
                            <span className="text-[11px] font-bold leading-none">חסר {shortage!.totalShortage}</span>
                            <span className="mt-0.5 text-[9px] leading-none opacity-80">
                              {shortage!.totalAssigned}/{shortage!.totalRequired}
                            </span>
                          </Link>
                        ) : (
                          <span
                            title={title}
                            className="inline-flex h-10 w-12 flex-col items-center justify-center rounded-lg bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400"
                          >
                            <span className="text-[11px] font-bold leading-none">✓</span>
                            <span className="mt-0.5 text-[9px] leading-none opacity-80">
                              {shortage!.totalAssigned}/{shortage!.totalRequired}
                            </span>
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

      {facilityHasRequirements && !isPending && visibleRows.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-6 w-8 items-center justify-center rounded bg-green-50 text-[11px] font-bold text-green-700 dark:bg-green-950/50 dark:text-green-400">✓</span>
            מאויש (מאויש/נדרש)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-6 w-8 items-center justify-center rounded bg-red-100 text-[11px] font-bold text-red-700 dark:bg-red-950/50 dark:text-red-400">חסר</span>
            פער כיסוי — לחץ לשיבוץ
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-6 w-8 items-center justify-center rounded bg-muted/40 text-xs text-muted-foreground/40">—</span>
            לא נדרש (אין משמרת)
          </div>
        </div>
      )}
    </PageLayout>
  );
}
