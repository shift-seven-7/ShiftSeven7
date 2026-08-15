"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import {
  CAPABILITY_LABELS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  DAY_GROUPS,
  STAFFING_REQUIREMENTS,
  type Category,
  type DayGroup,
  type RequirementCounts,
} from "@/lib/staffingRequirements";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type StaffingRequirement = Database["public"]["Tables"]["staffing_requirements"]["Row"];

// Requirement rows are keyed by facility_id (DB, normalized FK) here, but by
// facility `code` in the static STAFFING_REQUIREMENTS default table (which
// predates the DB and doesn't know about UUIDs) - see docs/MIGRATION_PLAN.md B.2.
const SLOT_KEY = (facilityId: string, day: DayGroup, cat: Category) => `${facilityId}::${day}::${cat}`;

function defaultFor(code: string | undefined, day: DayGroup, cat: Category): RequirementCounts {
  return STAFFING_REQUIREMENTS[code || ""]?.[day]?.[cat] || { supervisor: 0, guard: 0, dispatcher: 0 };
}

function NumberField({
  value,
  onChange,
  dirty,
}: {
  value: number;
  onChange: (v: string) => void;
  dirty: boolean;
}) {
  return (
    <Input
      type="number"
      min={0}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn("h-9 w-20 text-center font-semibold pr-1", dirty && "border-primary ring-1 ring-primary/40 bg-primary/5")}
    />
  );
}

export default function StaffingRequirementsPage() {
  const qc = useQueryClient();
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, RequirementCounts>>({});
  const [saving, setSaving] = useState(false);

  const { data: facilities = [] } = useQuery({
    queryKey: ["facilities"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("facilities").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ["staffing-requirements"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("staffing_requirements").select("*");
      if (error) throw error;
      return data;
    },
  });

  const activeFacilities = facilities.filter((f) => f.status !== "inactive");
  const effectiveFacility = facilities.find((f) => f.id === (selectedFacilityId || activeFacilities[0]?.id));
  const effectiveId = effectiveFacility?.id;

  const dbMap = useMemo(() => {
    const m: Record<string, StaffingRequirement> = {};
    requirements.forEach((r) => {
      m[SLOT_KEY(r.facility_id, r.day_group as DayGroup, r.category as Category)] = r;
    });
    return m;
  }, [requirements]);

  const effectiveFor = (facilityId: string | undefined, day: DayGroup, cat: Category): RequirementCounts => {
    if (!facilityId) return { supervisor: 0, guard: 0, dispatcher: 0 };
    const db = dbMap[SLOT_KEY(facilityId, day, cat)];
    if (db) return { supervisor: db.supervisor || 0, guard: db.guard || 0, dispatcher: db.dispatcher || 0 };
    return defaultFor(facilities.find((f) => f.id === facilityId)?.code, day, cat);
  };

  const current = (facilityId: string | undefined, day: DayGroup, cat: Category): RequirementCounts => {
    if (!facilityId) return { supervisor: 0, guard: 0, dispatcher: 0 };
    const key = SLOT_KEY(facilityId, day, cat);
    return key in edits ? edits[key] : effectiveFor(facilityId, day, cat);
  };

  const isDirty = (facilityId: string | undefined, day: DayGroup, cat: Category) => {
    if (!facilityId) return false;
    const key = SLOT_KEY(facilityId, day, cat);
    if (!(key in edits)) return false;
    const eff = effectiveFor(facilityId, day, cat);
    const e = edits[key];
    return e.supervisor !== eff.supervisor || e.guard !== eff.guard || e.dispatcher !== eff.dispatcher;
  };

  const dirtyCount = useMemo(
    () =>
      Object.keys(edits).filter((k) => {
        const [facilityId, day, cat] = k.split("::");
        return isDirty(facilityId, day as DayGroup, cat as Category);
      }).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [edits, dbMap],
  );

  const setVal = (facilityId: string, day: DayGroup, cat: Category, field: keyof RequirementCounts, val: string) => {
    const key = SLOT_KEY(facilityId, day, cat);
    const cur = current(facilityId, day, cat);
    setEdits({ ...edits, [key]: { ...cur, [field]: Math.max(0, parseInt(val) || 0) } });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      for (const key of Object.keys(edits)) {
        const [facilityId, day, cat] = key.split("::") as [string, DayGroup, Category];
        if (!isDirty(facilityId, day, cat)) continue;
        const e = edits[key];
        const existing = dbMap[key];
        const payload = { supervisor: e.supervisor, guard: e.guard, dispatcher: e.dispatcher };
        if (existing) {
          const { error } = await supabase.from("staffing_requirements").update(payload).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("staffing_requirements")
            .insert({ facility_id: facilityId, day_group: day, category: cat, ...payload });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staffing-requirements"] });
      setEdits({});
    },
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveMutation.mutateAsync();
      toast.success("התקינה נשמרה ותושלך אוטומטית על לוח הפערים");
    } catch {
      toast.error("שגיאה בשמירת התקינה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto" dir="rtl">
      <PageHeader title="תקינת כיסוי מינימלית" description="הגדרת כמות העובדים הנדרשת לכל משמרת — משתקפת אוטומטית בלוח פערי הסידור">
        <Button variant="outline" onClick={() => setEdits({})} disabled={dirtyCount === 0} className="gap-2">
          <RotateCcw className="w-4 h-4" /> בטל שינויים
        </Button>
        <Button onClick={handleSave} disabled={dirtyCount === 0 || saving} className="gap-2">
          <Save className="w-4 h-4" /> {saving ? "שומר..." : `שמור${dirtyCount > 0 ? ` (${dirtyCount})` : ""}`}
        </Button>
      </PageHeader>

      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 text-sm text-blue-700">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          הגדר כמה עובדים נדרשים מכל סוג בכל משמרת. ערך 0 = אין דרישה למשבצת זו. אחמ&quot;ש מכסה גם מאבטח ומוקדנית, ומאבטח מכסה
          גם מוקדנית — המערכת מחשבת את הפערים בהתאם.
        </span>
      </div>

      <div className="flex gap-1 bg-muted rounded-lg p-0.5 border border-border mb-5 w-fit">
        {activeFacilities.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedFacilityId(f.id)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
              effectiveId === f.id ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.name}
          </button>
        ))}
      </div>

      {isLoading || !effectiveFacility ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          {DAY_GROUPS.map((dg) => (
            <div key={dg.key} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{dg.label}</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-right py-2 px-4 text-xs font-medium text-muted-foreground">משמרת</th>
                    <th className="text-center py-2 px-4 text-xs font-medium text-muted-foreground">{CAPABILITY_LABELS.supervisor}</th>
                    <th className="text-center py-2 px-4 text-xs font-medium text-muted-foreground">{CAPABILITY_LABELS.guard}</th>
                    <th className="text-center py-2 px-4 text-xs font-medium text-muted-foreground">{CAPABILITY_LABELS.dispatcher}</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORY_ORDER.map((cat) => {
                    const cur = current(effectiveId, dg.key, cat);
                    const dirty = isDirty(effectiveId, dg.key, cat);
                    const total = (cur.supervisor || 0) + (cur.guard || 0) + (cur.dispatcher || 0);
                    return (
                      <tr key={cat} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 px-4">
                          <span className="font-medium">{CATEGORY_LABELS[cat]}</span>
                          {total === 0 && <span className="text-[10px] text-muted-foreground mr-2">(לא פעיל)</span>}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <NumberField value={cur.supervisor || 0} dirty={dirty} onChange={(v) => setVal(effectiveId!, dg.key, cat, "supervisor", v)} />
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <NumberField value={cur.guard || 0} dirty={dirty} onChange={(v) => setVal(effectiveId!, dg.key, cat, "guard", v)} />
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <NumberField value={cur.dispatcher || 0} dirty={dirty} onChange={(v) => setVal(effectiveId!, dg.key, cat, "dispatcher", v)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

          <p className="text-xs text-muted-foreground text-center">השינויים יחולו מיד לאחר השמירה בלוח פערי הסידור ובדשבורד.</p>
        </div>
      )}
    </div>
  );
}
