"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ShiftAssignment = Database["public"]["Tables"]["shift_assignments"]["Row"];
type ShiftTemplate = Database["public"]["Tables"]["shift_templates"]["Row"];

export default function ShiftEditPopover({
  assignment,
  template,
  open,
  onClose,
  onSaved,
}: {
  assignment: ShiftAssignment | null;
  template: ShiftTemplate | undefined;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [startTime, setStartTime] = useState(
    assignment ? new Date(assignment.actual_start).toTimeString().slice(0, 5) : "",
  );
  const [endTime, setEndTime] = useState(
    assignment ? new Date(assignment.actual_end).toTimeString().slice(0, 5) : "",
  );
  const [note, setNote] = useState(assignment?.override_reason || "");
  const [saving, setSaving] = useState(false);

  if (!assignment) return null;

  const handleSave = async () => {
    setSaving(true);
    const dateBase = assignment.date;
    const start = new Date(`${dateBase}T${startTime}`);
    const end = new Date(`${dateBase}T${endTime}`);
    if (end <= start) end.setDate(end.getDate() + 1);

    const supabase = createClient();
    const { error } = await supabase
      .from("shift_assignments")
      .update({ actual_start: start.toISOString(), actual_end: end.toISOString(), override_reason: note || null })
      .eq("id", assignment.id);

    setSaving(false);
    if (error) {
      toast.error("שגיאה בעדכון השיבוץ");
      return;
    }
    toast.success("שיבוץ עודכן בהצלחה ✅");
    onSaved?.();
    onClose();
  };

  const handleDelete = async () => {
    if (saving) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("shift_assignments").delete().eq("id", assignment.id);
    setSaving(false);
    if (error) {
      toast.error("שגיאה במחיקת השיבוץ");
      return;
    }
    toast.success("שיבוץ הוסר");
    onSaved?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg font-black text-primary">{assignment.shift_code}</span>
            <span className="text-sm font-semibold">{template?.name}</span>
            <span className="text-xs text-muted-foreground mr-auto">{assignment.staff_name}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">שעת התחלה</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">שעת סיום</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">הערה</Label>
            <Input placeholder="הוסף הערה..." value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 gap-1.5" onClick={handleSave} disabled={saving}>
              <Save className="w-3.5 h-3.5" />
              {saving ? "שומר..." : "שמור שינויים"}
            </Button>
            <Button variant="destructive" size="icon" onClick={handleDelete} disabled={saving}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
