'use client';

import { useEffect, useState } from 'react';
import { Phone, Shield, User } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { FormField } from '@/components/ui/form-field';
import { Segmented } from '@/components/ui/segmented';
import { useUpdateUser } from '@/hooks/queries/useUsers';
import { ASSIGNABLE_ROLES, ROLE_DISPLAY_NAMES, canManageRole } from '@/lib/constants/roles';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { identityLabel } from '@/lib/utils';
import type { UserRow } from '@/types/database.types';
import type { UserRole } from '@/types/roles';

/** Sentinel for "no role yet" — Segmented needs a string value. */
const PENDING = '__pending__';

interface EditUserDialogProps {
  user: UserRow | null;
  onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({ user, onOpenChange }: EditUserDialogProps) {
  const { role: actorRole, user: currentUser } = usePermissions();
  const update = useUpdateUser();

  const roleOptions = [
    ...(user?.app_role === null ? [{ value: PENDING, label: 'ממתין לאישור' }] : []),
    ...ASSIGNABLE_ROLES.filter((role) => canManageRole(actorRole, role)).map((role) => ({
      value: role as string,
      label: ROLE_DISPLAY_NAMES[role],
    })),
  ];

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<string>(PENDING);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name ?? '');
    setPhone(user.phone ?? '');
    setRole(user.app_role ?? PENDING);
    setIsActive(user.is_active);
  }, [user]);

  // Locking yourself out mid-session is the one mistake worth preventing in
  // the UI as well as the API.
  const isSelf = user?.id === currentUser?.id;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;

    try {
      await update.mutateAsync({
        id: user.id,
        full_name: fullName || null,
        phone: phone || null,
        app_role: role === PENDING ? null : (role as UserRole),
        is_active: isActive,
      });
      toast.success('המשתמש עודכן');
      onOpenChange(false);
    } catch {
      // Error toast comes from the mutation cache.
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>עריכת משתמש</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground" dir="ltr">
            {identityLabel(user?.email, user?.phone)}
          </p>

          <FormField label="שם מלא" icon={User}>
            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </FormField>

          <FormField label="טלפון" icon={Phone}>
            <Input
              type="tel"
              inputMode="tel"
              dir="ltr"
              className="text-start"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </FormField>

          <FormField
            label="תפקיד"
            icon={Shield}
            required
            hint={isSelf ? 'לא ניתן לשנות את התפקיד של עצמך' : undefined}
          >
            <Segmented options={roleOptions} value={role} onChange={setRole} disabled={isSelf} />
          </FormField>

          <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
            <div>
              <p className="text-sm font-medium">חשבון פעיל</p>
              <p className="text-xs text-muted-foreground">
                {isSelf ? 'לא ניתן להשבית את החשבון של עצמך' : 'משתמש מושבת לא יוכל להתחבר'}
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} disabled={isSelf} />
          </div>

          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'שומר...' : 'שמירה'}
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
