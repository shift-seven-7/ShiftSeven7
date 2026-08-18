'use client';

import { useMemo, useState } from 'react';
import { ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageTabs } from '@/components/ui/page-tabs';
import { cn } from '@/lib/utils';
import {
  useShift7StaffingRequirements,
  useUpsertShift7StaffingRequirement,
} from '@/hooks/queries/useShift7StaffingRequirements';
import { useShift7Facilities } from '@/hooks/queries/useShift7Facilities';
import type { Shift7Category, Shift7DayGroup } from '@/types/database.types';

interface Counts {
  supervisor: number;
  guard: number;
  dispatcher: number;
}

const DAY_GROUPS: { key: Shift7DayGroup; label: string }[] = [
  { key: 'weekday', label: 'ימי חול (א׳-ה׳)' },
  { key: 'friday', label: "יום ו׳" },
  { key: 'saturday', label: 'שבת' },
];
const CATEGORY_ORDER: Shift7Category[] = ['morning', 'afternoon', 'night'];
const CATEGORY_LABELS: Record<Shift7Category, string> = { morning: 'בוקר', afternoon: 'צהריים', night: 'לילה' };

const SLOT_KEY = (facilityId: string, day: Shift7DayGroup, cat: Shift7Category) =>
  `${facilityId}::${day}::${cat}`;

function NumberField({ value, onChange }: { value: number; onChange: (v: string) => void }) {
  return (
    <Input
      type="number"
      min={0}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-20 text-center font-semibold"
    />
  );
}

/**
 * Coverage matrix, per facility × day-group × shift category. Every cell
 * saves immediately on blur (upsert), rather than a page-level "save all" —
 * simpler than the source app's dirty-tracking batch save, and each cell's
 * failure stays isolated to that cell.
 */
export default function Shift7StaffingRequirementsPage() {
  const { data: facilities = [] } = useShift7Facilities();
  const { data: requirements = [], isPending } = useShift7StaffingRequirements();
  const upsert = useUpsertShift7StaffingRequirement();

  const activeFacilities = facilities.filter((f) => f.status !== 'inactive');
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const effectiveId = selectedFacilityId ?? activeFacilities[0]?.id;

  const dbMap = useMemo(() => {
    const map: Record<string, Counts> = {};
    for (const r of requirements) {
      map[SLOT_KEY(r.facility_id, r.day_group, r.category)] = {
        supervisor: r.supervisor,
        guard: r.guard,
        dispatcher: r.dispatcher,
      };
    }
    return map;
  }, [requirements]);

  const current = (day: Shift7DayGroup, cat: Shift7Category): Counts =>
    (effectiveId && dbMap[SLOT_KEY(effectiveId, day, cat)]) || { supervisor: 0, guard: 0, dispatcher: 0 };

  async function setVal(day: Shift7DayGroup, cat: Shift7Category, field: keyof Counts, raw: string) {
    if (!effectiveId) return;
    const value = Math.max(0, parseInt(raw, 10) || 0);
    const next = { ...current(day, cat), [field]: value };
    try {
      await upsert.mutateAsync({ facility_id: effectiveId, day_group: day, category: cat, ...next });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בשמירת התקינה');
    }
  }

  return (
    <PageLayout title="תקינת כיסוי מינימלית" subtitle="הגדרת כמות העובדים הנדרשת לכל משמרת">
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          הגדר כמה עובדים נדרשים מכל סוג בכל משמרת. ערך 0 = אין דרישה. אחמ&quot;ש מכסה גם מאבטח ומוקדנית, ומאבטח מכסה
          גם מוקדנית.
        </span>
      </div>

      {activeFacilities.length > 1 && (
        <PageTabs
          value={effectiveId ?? ''}
          onChange={setSelectedFacilityId}
          className="mb-4"
          ariaLabel="מתקן"
          tabs={activeFacilities.map((f) => ({ value: f.id, label: f.name }))}
        />
      )}

      {isPending || !effectiveId ? (
        <p className="py-16 text-center text-sm text-muted-foreground">טוען...</p>
      ) : (
        <div className="space-y-5">
          {DAY_GROUPS.map((dg) => (
            <Card key={dg.key} className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/60 bg-card/50 px-4 py-2.5">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{dg.label}</h3>
              </div>
              <CardContent className="p-0">
                <div className="hidden grid-cols-[1fr_80px_80px_80px] gap-4 border-b border-border/60 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
                  <span>משמרת</span>
                  <span className="text-center">אחמ&quot;ש</span>
                  <span className="text-center">מאבטח</span>
                  <span className="text-center">מוקדן</span>
                </div>
                {CATEGORY_ORDER.map((cat) => {
                  const cur = current(dg.key, cat);
                  const total = cur.supervisor + cur.guard + cur.dispatcher;
                  return (
                    <div
                      key={cat}
                      className={cn(
                        'grid grid-cols-1 items-center gap-2 border-b border-border/40 px-4 py-2.5 last:border-0 md:grid-cols-[1fr_80px_80px_80px] md:gap-4'
                      )}
                    >
                      <span className="font-medium">
                        {CATEGORY_LABELS[cat]}
                        {total === 0 && <span className="ms-2 text-[10px] text-muted-foreground">(לא פעיל)</span>}
                      </span>
                      <NumberField value={cur.supervisor} onChange={(v) => setVal(dg.key, cat, 'supervisor', v)} />
                      <NumberField value={cur.guard} onChange={(v) => setVal(dg.key, cat, 'guard', v)} />
                      <NumberField value={cur.dispatcher} onChange={(v) => setVal(dg.key, cat, 'dispatcher', v)} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
