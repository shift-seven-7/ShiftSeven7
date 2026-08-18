'use client';

import { useEffect, useState } from 'react';
import { Mail, Shield, Smartphone, User } from 'lucide-react';
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
import { Segmented } from '@/components/ui/segmented';
import { useInviteUser } from '@/hooks/queries/useUsers';
import { ASSIGNABLE_ROLES, ROLE_DISPLAY_NAMES, canManageRole } from '@/lib/constants/roles';
import { getInviteChannels, isPasswordEnabled } from '@/lib/auth/methods';
import { usePermissions } from '@/lib/hooks/usePermissions';
import type { UserRole } from '@/types/roles';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// E.164, which is what Supabase expects for a phone identity.
const PHONE_RE = /^\+[1-9]\d{7,14}$/;

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const { role: actorRole } = usePermissions();
  const invite = useInviteUser();

  // Only roles the current user is allowed to hand out.
  const roleOptions = ASSIGNABLE_ROLES.filter((role) => canManageRole(actorRole, role)).map(
    (role) => ({ value: role, label: ROLE_DISPLAY_NAMES[role] })
  );

  // An invitation has to arrive somewhere the invitee can actually sign in
  // from. On an email deployment that is an address; on a phone-OTP
  // deployment, a number. Email wins when both are available.
  const byEmail = getInviteChannels().includes('email');

  const [identifier, setIdentifier] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>(roleOptions[0]?.value ?? 'SYSTEM_MANAGER');
  const [touched, setTouched] = useState(false);

  // Reset on open so a previous attempt's values never leak into a new one.
  useEffect(() => {
    if (open) {
      setIdentifier('');
      setFullName('');
      setRole(roleOptions[0]?.value ?? 'SYSTEM_MANAGER');
      setTouched(false);
    }
    // roleOptions is derived from a stable role; re-running on open is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isValid = byEmail ? EMAIL_RE.test(identifier) : PHONE_RE.test(identifier);
  const identifierError =
    touched && !isValid
      ? byEmail
        ? 'כתובת אימייל לא תקינה'
        : 'מספר טלפון לא תקין (בפורמט בינלאומי, למשל ‎+972501234567)'
      : null;
  const canSubmit = isValid && !invite.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit) return;

    try {
      await invite.mutateAsync({
        ...(byEmail ? { email: identifier } : { phone: identifier }),
        fullName: fullName || undefined,
        role,
      });
      toast.success('המשתמש נוצר בהצלחה');
      onOpenChange(false);
    } catch {
      // The mutation cache surfaces the error toast.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>הוספת משתמש</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label={byEmail ? 'אימייל' : 'מספר טלפון'}
            icon={byEmail ? Mail : Smartphone}
            required
            error={identifierError}
          >
            <Input
              type={byEmail ? 'email' : 'tel'}
              inputMode={byEmail ? 'email' : 'tel'}
              dir="ltr"
              className="text-start"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              onBlur={() => setTouched(true)}
              autoFocus
            />
          </FormField>

          <FormField label="שם מלא" icon={User}>
            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </FormField>

          <FormField
            label="תפקיד"
            icon={Shield}
            required
            hint={
              isPasswordEnabled()
                ? 'המשתמש יגדיר סיסמה דרך ״שכחתי סיסמה״, או יתחבר בשיטה אחרת שהוגדרה'
                : 'המשתמש יתחבר בשיטה שהוגדרה למערכת'
            }
          >
            <Segmented options={roleOptions} value={role} onChange={setRole} />
          </FormField>

          {/* RTL: the primary action sits on the start edge (right). */}
          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button type="submit" disabled={!canSubmit}>
              {invite.isPending ? 'יוצר...' : 'יצירה'}
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
