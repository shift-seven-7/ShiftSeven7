import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  STAFFING_REQUIREMENTS, CATEGORY_LABELS, CATEGORY_ORDER, DAY_GROUPS, CAPABILITY_LABELS,
} from "@/lib/staffingRequirements";
import { SlidersHorizontal, Save, RotateCcw, ShieldCheck } from "lucide-react";

const SLOT_KEY = (code, day, cat) => `${code}::${day}::${cat}`;

function defaultFor(code, day, cat) {
  return STAFFING_REQUIREMENTS[code]?.[day]?.[cat] || { supervisor: 0, guard: 0, dispatcher: 0 };
}

function NumberField({ value, onChange, dirty }) {
  return (
    <div className="relative">
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 w-20 text-center font-semibold pr-1",
          dirty && "border-primary ring-1 ring-primary/40 bg-primary/5"
        )}
      />
    </div>
  );
}

export default function StaffingRequirementsPage() {
  const qc = useQueryClient();
  const [selectedCode, setSelectedCode] = useState(null);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);

  const { data: facilities = [] } = useQuery({ queryKey: ["facilities"], queryFn: () => base44.entities.Facility.list() });
  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ["staffing-requirements"],
    queryFn: () => base44.entities.StaffingRequirement.list(),
  });

  const activeFacilities = facilities.filter((f) => f.status !== "inactive");
  const effectiveCode = selectedCode || activeFacilities[0]?.code;
  const effectiveFacility = facilities.find((f) => f.code === effectiveCode);

  const dbMap = useMemo(() => {
    const m = {};
    requirements.forEach((r) => { m[SLOT_KEY(r.facility_code, r.day_group, r.category)] = r; });
    return m;
  }, [requirements]);

  const effectiveFor = (code, day, cat) => {
    const db = dbMap[SLOT_KEY(code, day, cat)];
    if (db) return { supervisor: db.supervisor || 0, guard: db.guard || 0, dispatcher: db.dispatcher || 0 };
    return defaultFor(code, day, cat);
  };

  const current = (code, day, cat) => {
    const key = SLOT_KEY(code, day, cat);
    return key in edits ? edits[key] : effectiveFor(code, day, cat);
  };

  const isDirty = (code, day, cat) => {
    const key = SLOT_KEY(code, day, cat);
    if (!(key in edits)) return false;
    const eff = effectiveFor(code, day, cat);
    const e = edits[key];
    return e.supervisor !== eff.supervisor || e.guard !== eff.guard || e.dispatcher !== eff.dispatcher;
  };

  const dirtyCount = useMemo(
    () => Object.keys(edits).filter((k) => {
      const [code, day, cat] = k.split("::");
      return isDirty(code, day, cat);
    }).length,
    [edits, dbMap]
  );

  const setVal = (code, day, cat, field, val) => {
    const key = SLOT_KEY(code, day, cat);
    const cur = current(code, day, cat);
    setEdits({ ...edits, [key]: { ...cur, [field]: Math.max(0, parseInt(val) || 0) } });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ops = [];
      for (const key of Object.keys(edits)) {
        const [code, day, cat] = key.split("::");
        if (!isDirty(code, day, cat)) continue;
        const e = edits[key];
        const existing = dbMap[key];
        const payload = { supervisor: e.supervisor, guard: e.guard, dispatcher: e.dispatcher };
        if (existing) {
          ops.push(base44.entities.StaffingRequirement.update(existing.id, payload));
        } else {
          ops.push(base44.entities.StaffingRequirement.create({
            facility_code: code, day_group: day, category: cat, ...payload,
          }));
        }
      }
      await Promise.all(ops);
      toast.success("התקינה נשמרה ותושלך אוטומטית על לוח הפערים");
      qc.invalidateQueries({ queryKey: ["staffing-requirements"] });
      setEdits({});
    } catch (err) {
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
          הגדר כמה עובדים נדרשים מכל סוג בכל משמרת. ערך 0 = אין דרישה למשבצת זו. אחמ"ש מכסה גם מאבטח ומוקדנית, ומאבטח מכסה גם מוקדנית — המערכת מחשבת את הפערים בהתאם.
        </span>
      </div>

      {/* Facility selector */}
      <div className="flex gap-1 bg-muted rounded-lg p-0.5 border border-border mb-5 w-fit">
        {activeFacilities.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedCode(f.code)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
              effectiveCode === f.code ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
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
                    const cur = current(effectiveCode, dg.key, cat);
                    const dirty = isDirty(effectiveCode, dg.key, cat);
                    const total = cur.supervisor + cur.guard + cur.dispatcher;
                    return (
                      <tr key={cat} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 px-4">
                          <span className="font-medium">{CATEGORY_LABELS[cat]}</span>
                          {total === 0 && (
                            <span className="text-[10px] text-muted-foreground mr-2">(לא פעיל)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <NumberField value={cur.supervisor} dirty={dirty} onChange={(v) => setVal(effectiveCode, dg.key, cat, "supervisor", v)} />
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <NumberField value={cur.guard} dirty={dirty} onChange={(v) => setVal(effectiveCode, dg.key, cat, "guard", v)} />
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <NumberField value={cur.dispatcher} dirty={dirty} onChange={(v) => setVal(effectiveCode, dg.key, cat, "dispatcher", v)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

          <p className="text-xs text-muted-foreground text-center">
            השינויים יחולו מיד לאחר השמירה בלוח פערי הסידור ובדשבורד.
          </p>
        </div>
      )}
    </div>
  );
}