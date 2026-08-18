'use client';

import { useEffect, useState } from 'react';
import { Clock, Hash, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/ui/form-field';
import { TimeInput } from '@/components/ui/time-input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useCreateShift7ShiftTemplate,
  useDeleteShift7ShiftTemplate,
  useShift7ShiftTemplates,
  useUpdateShift7ShiftTemplate,
} from '@/hooks/queries/useShift7ShiftTemplates';
import { useShift7Facilities } from '@/hooks/queries/useShift7Facilities';
import type { Shift7Category, Shift7StaffRole, ShiftTemplateRow } from '@/types/database.types';

/** UI-only sentinel for "every facility" — the DB column is a nullable FK, null = global. */
const ALL_FACILITIES = '__all__';

interface FormState {
  code: string;
  name: string;
  category: Shift7Category;
  start_time: string;
  end_time: string;
  applicable_roles: Shift7StaffRole[];
  facility: string;
  post_number: string;
}

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  category: 'morning',
  start_time: '06:00',
  end_time: '14:00',
  applicable_roles: ['guard'],
  facility: ALL_FACILITIES,
  post_number: '',
};

/** 1-3 letters, optional trailing digit — matches the server-side check. */
function isValidShiftCode(code: string): boolean {
  return /^[A-Za-z]{1,3}\d?$/.test(code);
}

function calcDuration(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60; // overnight
  return Math.round((diff / 60) * 10) / 10;
}

const CATEGORY_LABELS: Record<Shift7Category, string> = { morning: 'בוקר', afternoon: 'צהריים', night: 'לילה' };

export default function Shift7ShiftTemplatesPage() {
  const { data: templates = [], isPending } = useShift7ShiftTemplates();
  const { data: facilities = [] } = useShift7Facilities();
  const create = useCreateShift7ShiftTemplate();
  const update = useUpdateShift7ShiftTemplate();
  const remove = useDeleteShift7ShiftTemplate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftTemplateRow | null>(null);
  const [deleting, setDeleting] = useState<ShiftTemplateRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    if (!dialogOpen) return;
    setForm(
      editing
        ? {
            code: editing.code,
            name: editing.name,
            category: editing.category,
            start_time: editing.start_time.slice(0, 5),
            end_time: editing.end_time.slice(0, 5),
            applicable_roles: editing.applicable_roles,
            facility: editing.facility ?? ALL_FACILITIES,
            post_number: editing.post_number != null ? String(editing.post_number) : '',
          }
        : EMPTY_FORM
    );
  }, [dialogOpen, editing]);

  const facilityName = (id: string | null) => (id ? facilities.find((f) => f.id === id)?.name ?? '—' : 'כל המתקנים');
  const isPending_ = create.isPending || update.isPending;

  function toggleRole(role: Shift7StaffRole) {
    const roles = form.applicable_roles.includes(role)
      ? form.applicable_roles.filter((r) => r !== role)
      : [...form.applicable_roles, role];
    setForm({ ...form, applicable_roles: roles });
  }

  async function handleSave() {
    if (!isValidShiftCode(form.code)) {
      toast.error('קוד משמרת בלתי חוקי. השתמש ב-1-3 אותיות ובאופציונלית ספרה (לדוגמה: M, A1, N)');
      return;
    }
    const payload = {
      code: form.code.toUpperCase(),
      name: form.name.trim(),
      category: form.category,
      start_time: form.start_time,
      end_time: form.end_time,
      duration_hours: calcDuration(form.start_time, form.end_time),
      applicable_roles: form.applicable_roles,
      facility: form.facility === ALL_FACILITIES ? null : form.facility,
      post_number: form.post_number !== '' ? Number(form.post_number) : null,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload });
        toast.success('תבנית משמרת עודכנה');
      } else {
        await create.mutateAsync(payload);
        toast.success('תבנית משמרת נוצרה בהצלחה');
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בשמירה');
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success('תבנית הוסרה בהצלחה');
      setDeleting(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה במחיקה');
    }
  }

  return (
    <PageLayout
      title="תבניות משמרת"
      subtitle="הגדרת קודי משמרת, שעות ותפקידים"
      actions={
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">הוסף תבנית</span>
        </Button>
      }
    >
      {isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border border-border rounded-lg bg-card/50 py-16 text-center">
          <Clock className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">אין תבניות משמרת</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-5">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                      <span className="text-sm font-bold text-primary">{t.code}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold">{t.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {t.start_time.slice(0, 5)} — {t.end_time.slice(0, 5)} ({t.duration_hours} שעות)
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="עריכה"
                      onClick={() => {
                        setEditing(t);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      aria-label="מחיקה"
                      onClick={() => setDeleting(t)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {CATEGORY_LABELS[t.category]}
                  </Badge>
                  {t.applicable_roles.map((r) => (
                    <Badge key={r} variant="outline" className="text-xs">
                      {r === 'guard' ? 'מאבטח' : 'מוקדן'}
                    </Badge>
                  ))}
                  <Badge variant="outline" className="text-xs">
                    {facilityName(t.facility)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'עריכת תבנית' : 'הוספת תבנית משמרת'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField icon={Hash} label="קוד משמרת" required hint="לדוגמה: M, A1, N">
              <Input
                value={form.code}
                maxLength={4}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </FormField>
            <FormField icon={Clock} label="שם" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormField>
            <FormField icon={Clock} label="קטגוריה">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Shift7Category })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">בוקר</SelectItem>
                  <SelectItem value="afternoon">צהריים</SelectItem>
                  <SelectItem value="night">לילה</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField icon={Clock} label="מתקן">
              <Select value={form.facility} onValueChange={(v) => setForm({ ...form, facility: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FACILITIES}>כל המתקנים</SelectItem>
                  {facilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField icon={Clock} label="שעת התחלה">
              <TimeInput value={form.start_time} onChange={(v) => setForm({ ...form, start_time: v })} />
            </FormField>
            <FormField icon={Clock} label="שעת סיום">
              <TimeInput value={form.end_time} onChange={(v) => setForm({ ...form, end_time: v })} />
            </FormField>
            <FormField className="md:col-span-2" icon={Clock} label="תפקידים מורשים">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.applicable_roles.includes('guard')} onCheckedChange={() => toggleRole('guard')} />
                  מאבטח
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.applicable_roles.includes('dispatcher')}
                    onCheckedChange={() => toggleRole('dispatcher')}
                  />
                  מוקדן
                </label>
              </div>
            </FormField>
            <FormField icon={Hash} label="מספר עמדה" hint="אופציונלי">
              <Input
                type="number"
                min={1}
                value={form.post_number}
                onChange={(e) => setForm({ ...form, post_number: e.target.value })}
              />
            </FormField>
          </div>
          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button onClick={handleSave} disabled={!form.code || !form.name || isPending_}>
              {isPending_ ? 'שומר...' : editing ? 'עדכן' : 'צור'} תבנית
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>הסרת תבנית</AlertDialogTitle>
            <AlertDialogDescription>
              האם להסיר את תבנית המשמרת &quot;{deleting?.name}&quot;? לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              הסר תבנית
            </AlertDialogAction>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
