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
import { useDeleteUser } from '@/hooks/queries/useUsers';
import { identityLabel } from '@/lib/utils';
import type { UserRow } from '@/types/database.types';

interface DeleteUserDialogProps {
  user: UserRow | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * AlertDialog rather than Dialog: this is destructive and irreversible, so it
 * deliberately has no dismiss-by-clicking-outside.
 */
export function DeleteUserDialog({ user, onOpenChange }: DeleteUserDialogProps) {
  const remove = useDeleteUser();

  async function handleConfirm() {
    if (!user) return;
    try {
      await remove.mutateAsync(user.id);
      toast.success('המשתמש נמחק');
      onOpenChange(false);
    } catch {
      // Error toast comes from the mutation cache.
    }
  }

  return (
    <AlertDialog open={!!user} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>למחוק את המשתמש?</AlertDialogTitle>
          <AlertDialogDescription>
            {user?.full_name || identityLabel(user?.email, user?.phone)} יימחק לצמיתות
            ולא יוכל להתחבר יותר. לא
            ניתן לבטל את הפעולה.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* RTL: reversed so the primary action lands on the start edge (right). */}
        <AlertDialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              handleConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {remove.isPending ? 'מוחק...' : 'מחיקה'}
          </AlertDialogAction>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
