"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { validateShiftCode } from "@/lib/shiftValidation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ShiftTemplate = Database["public"]["Tables"]["shift_templates"]["Row"];
type ShiftTemplateInsert = Database["public"]["Tables"]["shift_templates"]["Insert"];

// "all" is a UI-only sentinel (Radix Select can't hold an empty string) for
// "applies to every facility" - the DB column (shift_templates.facility) is
// a nullable FK, null meaning global. Translated at the save/load boundary.
const EMPTY_FORM = {
  code: "",
  name: "",
  category: "morning",
  start_time: "06:00",
  end_time: "14:00",
  applicable_roles: ["guard"] as string[],
  facility: "all",
  post_number: "",
  color: "#3b82f6",
};

export default function ShiftTemplatesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("shift_templates").select("*").order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: facilities = [] } = useQuery({
    queryKey: ["facilities"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("facilities").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { id: string | null; data: ShiftTemplateInsert }) => {
      const supabase = createClient();
      if (payload.id) {
        const { error } = await supabase.from("shift_templates").update(payload.data).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shift_templates").insert(payload.data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("shift_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };
  const openEdit = (t: ShiftTemplate) => {
    setEditingId(t.id);
    setForm({
      code: t.code,
      name: t.name,
      category: t.category,
      start_time: t.start_time.slice(0, 5),
      end_time: t.end_time.slice(0, 5),
      applicable_roles: t.applicable_roles,
      facility: t.facility ?? "all",
      post_number: t.post_number != null ? String(t.post_number) : "",
      color: t.color || "#3b82f6",
    });
    setDialogOpen(true);
  };

  const calcDuration = (start: string, end: string) => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let diff = eh * 60 + em - (sh * 60 + sm);
    if (diff <= 0) diff += 24 * 60; // overnight
    return Math.round((diff / 60) * 10) / 10;
  };

  const handleSave = async () => {
    if (!validateShiftCode(form.code)) {
      toast.error("קוד משמרת בלתי חוקי. השתמש 1-3 אותיות ובאופציונלית ספרה (לדוגמא: M, A1, N).");
      return;
    }
    const data: ShiftTemplateInsert = {
      code: form.code,
      name: form.name,
      category: form.category,
      start_time: form.start_time,
      end_time: form.end_time,
      duration_hours: calcDuration(form.start_time, form.end_time),
      applicable_roles: form.applicable_roles,
      facility: form.facility === "all" ? null : form.facility,
      post_number: form.post_number !== "" ? Number(form.post_number) : null,
      color: form.color,
    };
    try {
      await saveMutation.mutateAsync({ id: editingId, data });
      toast.success(editingId ? "תבנית משמרת עודכנה" : "תבנית משמרת נוצרה בהצלחה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשמירה");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("תבנית הוסרה בהצלחה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה במחיקה");
    }
  };

  const toggleRole = (role: string) => {
    const roles = form.applicable_roles.includes(role)
      ? form.applicable_roles.filter((r) => r !== role)
      : [...form.applicable_roles, role];
    setForm({ ...form, applicable_roles: roles });
  };

  const catColors: Record<string, string> = {
    morning: "bg-amber-100 text-amber-800",
    afternoon: "bg-blue-100 text-blue-800",
    night: "bg-violet-100 text-violet-800",
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="תבניות משמרת" description="הגדרת קודי משמרת, שעות ותפקידים">
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> הוסף תבנית
        </Button>
      </PageHeader>

      {templates.length === 0 && !isLoading ? (
        <EmptyState icon={Clock} title="אין תבניות משמרת" description="צור תבניות משמרת להגדרת לוחות עבודה.">
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> הוסף תבנית
          </Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{t.code}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">{t.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t.start_time.slice(0, 5)} — {t.end_time.slice(0, 5)} ({t.duration_hours}h)
                    </p>
                    {t.post_number && <p className="text-xs text-muted-foreground">עמדה: {t.post_number}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${catColors[t.category] || ""}`}>
                  {t.category}
                </span>
                {(t.applicable_roles || []).map((r) => (
                  <Badge key={r} variant="secondary" className="text-xs capitalize">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "עריכת תבנית" : "הוספת תבנית משמרת"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>קוד משמרת</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="לדוגמא: M, A1, N"
                  maxLength={4}
                />
              </div>
              <div>
                <Label>שם</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="בוקר" />
              </div>
              <div>
                <Label>קטגוריה</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">בוקר</SelectItem>
                    <SelectItem value="afternoon">צהריים</SelectItem>
                    <SelectItem value="night">לילה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>מתקן</Label>
                <Select value={form.facility} onValueChange={(v) => setForm({ ...form, facility: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל המתקנים</SelectItem>
                    {facilities.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>שעת התחלה</Label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div>
                <Label>שעת סיום</Label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">תפקידים מורשים</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.applicable_roles.includes("guard")} onCheckedChange={() => toggleRole("guard")} />
                  מאבטח
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.applicable_roles.includes("dispatcher")} onCheckedChange={() => toggleRole("dispatcher")} />
                  מוקדן
                </label>
              </div>
            </div>
            <div>
              <Label>מספר עמדה</Label>
              <Input
                type="number"
                min="1"
                value={form.post_number}
                onChange={(e) => setForm({ ...form, post_number: e.target.value })}
                placeholder="לדוגמא: 1, 2, 3"
              />
            </div>
            <div>
              <Label className="mb-2 block">צבע משמרת</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color || "#3b82f6"}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border border-input"
                />
                <span className="text-sm font-mono text-muted-foreground">{form.color || "#3b82f6"}</span>
              </div>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={!form.code || !form.name || saveMutation.isPending}>
              {editingId ? "עדכן" : "צור"} תבנית
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
