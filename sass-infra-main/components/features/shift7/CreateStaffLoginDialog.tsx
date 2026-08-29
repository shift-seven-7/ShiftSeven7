'use client';

import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { useCreateShift7StaffLogin } from '@/hooks/queries/useShift7Staff';
import type { StaffRow } from '@/types/database.types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CreateStaffLoginDialogProps {
  staff: StaffRow | null;
  onOpenChange: (open: boolean) => void;
}

/** One field, same shape as InviteUserDialog — see the `form-dialogs` skill. */
export function CreateStaffLoginDialog({ staff, onOpenChange }: CreateStaffLoginDialogProps) {
  const createLogin = useCreateShift7StaffLogin();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (staff) {
      setEmail(staff.email ?? '');
      setTouched(false);
    }
  }, [staff]);

  const isValid = EMAIL_RE.test(email);
  const emailError = touched && !isValid ? 'כתובת אימייל לא תקינה' : null;
  const canSubmit = isValid && !createLogin.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit || !staff) return;

    try {
      await createLogin.mutateAsync({ id: staff.id, email });
      toast.success('חשבון ההתחברות נוצר בהצלחה');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'יצירת החשבון נכשלה');
    }
  }

  return (
    <Dialog open={!!staff} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>יצירת חשבון התחברות</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            עבור <span className="font-medium text-foreground">{staff?.full_name}</span> (מספר
            עובד: {staff?.employee_id})
          </p>

          <FormField
            label="אימייל"
            icon={Mail}
            required
            error={emailError}
            hint="המשתמש יגדיר סיסמה דרך ״שכחתי סיסמה״ בעמוד ההתחברות"
          >
            <Input
              type="email"
              inputMode="email"
              dir="ltr"
              className="text-start"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => setTouched(true)}
              autoFocus
            />
          </FormField>

          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button type="submit" disabled={!canSubmit}>
              {createLogin.isPending ? 'יוצר...' : 'יצירה'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
