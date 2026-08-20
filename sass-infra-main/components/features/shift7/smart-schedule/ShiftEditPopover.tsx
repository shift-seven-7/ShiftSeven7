'use client';

import { useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useDeleteShift7ShiftAssignment,
  useUpdateShift7ShiftAssignment,
} from '@/hooks/queries/useShift7ShiftAssignments';
import type { ShiftAssignmentRow, ShiftTemplateRow } from '@/types/database.types';

interface ShiftEditPopoverProps {
  assignment: ShiftAssignmentRow;
  template: ShiftTemplateRow | undefined;
  open: boolean;
  onClose: () => void;
}

/** Quick edit for one placed shift — times, a note, or remove it entirely. */
export function ShiftEditPopover({ assignment, template, open, onClose }: ShiftEditPopoverProps) {
  const [startTime, setStartTime] = useState(() => new Date(assignment.actual_start).toTimeString().slice(0, 5));
  const [endTime, setEndTime] = useState(() => new Date(assignment.actual_end).toTimeString().slice(0, 5));
  const [note, setNote] = useState(assignment.override_reason ?? '');
  const update = useUpdateShift7ShiftAssignment();
  const del = useDeleteShift7ShiftAssignment();
  const saving = update.isPending || del.isPending;

  const handleSave = async () => {
    const start = new Date(`${assignment.date}T${startTime}:00`);
    const end = new Date(`${assignment.date}T${endTime}:00`);
    if (end <= start) end.setDate(end.getDate() + 1);

    try {
      await update.mutateAsync({
        id: assignment.id,
        actual_start: start.toISOString(),
        actual_end: end.toISOString(),
        override_reason: note || null,
      });
      toast.success('שיבוץ עודכן בהצלחה');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בעדכון השיבוץ');
    }
  };

  const handleDelete = async () => {
    try {
      await del.mutateAsync(assignment.id);
      toast.success('שיבוץ הוסר');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה במחיקת השיבוץ');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg font-black text-primary">{assignment.shift_code}</span>
            <span className="text-sm font-semibold">{template?.name}</span>
            <span className="me-auto text-xs font-normal text-muted-foreground">{assignment.staff_name}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-1 space-y-4">
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
            <Input
              placeholder="הוסף הערה..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 gap-1.5" onClick={handleSave} disabled={saving}>
              <Save className="h-3.5 w-3.5" />
              {update.isPending ? 'שומר...' : 'שמור שינויים'}
            </Button>
            <Button variant="destructive" size="icon" onClick={handleDelete} disabled={saving}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
