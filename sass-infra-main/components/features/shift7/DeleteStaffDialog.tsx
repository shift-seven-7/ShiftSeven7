'use client';

import { toast } from 'sonner';
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
import { useDeleteShift7Staff } from '@/hooks/queries/useShift7Staff';
import type { StaffRow } from '@/types/database.types';

interface DeleteStaffDialogProps {
  staff: StaffRow | null;
  onOpenChange: (open: boolean) => void;
}

/** AlertDialog, not Dialog: destructive and irreversible — see `form-dialogs`. */
export function DeleteStaffDialog({ staff, onOpenChange }: DeleteStaffDialogProps) {
  const remove = useDeleteShift7Staff();

  async function handleConfirm() {
    if (!staff) return;
    try {
      await remove.mutateAsync(staff.id);
      toast.success(`${staff.full_name} הוסר בהצלחה`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה במחיקה');
    }
  }

  return (
    <AlertDialog open={!!staff} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>הסרת עובד</AlertDialogTitle>
          <AlertDialogDescription>
            האם אתה בטוח שברצונך להסיר את &quot;{staff?.full_name}&quot; (מספר עובד:{' '}
            {staff?.employee_id})? פעולה זו תמחק את רשומת העובד. לא ניתן לבטל פעולה זו.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              handleConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {remove.isPending ? 'מוחק...' : 'הסר עובד'}
          </AlertDialogAction>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
