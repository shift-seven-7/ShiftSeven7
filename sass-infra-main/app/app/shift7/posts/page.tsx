'use client';

import { useEffect, useState } from 'react';
import { Building2, Hash, MapPin, Pencil, Plus, Shield, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/ui/form-field';
import { Segmented } from '@/components/ui/segmented';
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
  useCreateShift7Post,
  useDeleteShift7Post,
  useShift7Posts,
  useUpdateShift7Post,
} from '@/hooks/queries/useShift7Posts';
import { useShift7Facilities } from '@/hooks/queries/useShift7Facilities';
import type { PostRow, Shift7PostType, Shift7StaffRole } from '@/types/database.types';

interface FormState {
  name: string;
  code: string;
  type: Shift7PostType;
  facility: string;
  required_role: Shift7StaffRole;
}

const EMPTY_FORM: FormState = { name: '', code: '', type: 'static', facility: '', required_role: 'guard' };

/** Posts — reference-data CRUD, same shape as the staff/facilities pattern. */
export default function Shift7PostsPage() {
  const { data: posts = [], isPending } = useShift7Posts();
  const { data: facilities = [] } = useShift7Facilities();
  const create = useCreateShift7Post();
  const update = useUpdateShift7Post();
  const remove = useDeleteShift7Post();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PostRow | null>(null);
  const [deleting, setDeleting] = useState<PostRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    if (!dialogOpen) return;
    setForm(
      editing
        ? {
            name: editing.name,
            code: editing.code,
            type: editing.type,
            facility: editing.facility,
            required_role: editing.required_role,
          }
        : EMPTY_FORM
    );
  }, [dialogOpen, editing]);

  const facilityName = (id: string) => facilities.find((f) => f.id === id)?.name ?? '—';
  const isPending_ = create.isPending || update.isPending;

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  async function handleSave() {
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      type: form.type,
      facility: form.facility,
      // Matches the source app: control_room posts are dispatcher-only, static posts guard-only.
      required_role: (form.type === 'control_room' ? 'dispatcher' : 'guard') as Shift7StaffRole,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload });
        toast.success('עמדה עודכנה');
      } else {
        await create.mutateAsync(payload);
        toast.success('עמדה נוצרה בהצלחה');
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
      toast.success('עמדה הוסרה בהצלחה');
      setDeleting(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה במחיקה');
    }
  }

  return (
    <PageLayout
      title="עמדות שמירה"
      subtitle="ניהול עמדות סטטיות ומוקדי בקרה"
      actions={
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">הוסף עמדה</span>
        </Button>
      }
    >
      {isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border border-border rounded-lg bg-card/50 py-16 text-center">
          <MapPin className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">לא הוגדרו עמדות</p>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> הוסף עמדה
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="p-5">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{post.name}</h3>
                    <p className="font-mono text-xs text-muted-foreground">{post.code}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="עריכה"
                      onClick={() => {
                        setEditing(post);
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
                      onClick={() => setDeleting(post)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={post.type === 'control_room' ? 'default' : 'outline'} className="text-xs">
                    {post.type === 'control_room' ? 'חדר מוקד' : 'עמדה סטטית'}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {post.required_role === 'dispatcher' ? 'מוקדן' : 'מאבטח'}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {facilityName(post.facility)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'עריכת עמדה' : 'הוספת עמדה'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField className="md:col-span-2" icon={MapPin} label="שם עמדה" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormField>
            <FormField icon={Hash} label="קוד" required hint="לדוגמה: GP1">
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </FormField>
            <FormField icon={Shield} label="סוג">
              <Segmented
                value={form.type}
                onChange={(v) => setForm({ ...form, type: v as Shift7PostType })}
                options={[
                  { value: 'static', label: 'עמדה סטטית' },
                  { value: 'control_room', label: 'חדר מוקד' },
                ]}
                ariaLabel="סוג עמדה"
              />
            </FormField>
            <FormField className="md:col-span-2" icon={Building2} label="מתקן" required>
              <Select value={form.facility} onValueChange={(v) => setForm({ ...form, facility: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר..." />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button onClick={handleSave} disabled={!form.name || !form.code || !form.facility || isPending_}>
              {isPending_ ? 'שומר...' : editing ? 'עדכן' : 'צור'} עמדה
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
            <AlertDialogTitle>הסרת עמדה</AlertDialogTitle>
            <AlertDialogDescription>
              האם להסיר את העמדה &quot;{deleting?.name}&quot;? לא ניתן לבטל פעולה זו.
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
              הסר עמדה
            </AlertDialogAction>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
