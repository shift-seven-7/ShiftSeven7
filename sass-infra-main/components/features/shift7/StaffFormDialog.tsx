'use client';

import { useEffect, useState } from 'react';
import { Building2, Hash, Mail, Phone, Shield, ShieldAlert, User } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/ui/form-field';
import { Segmented } from '@/components/ui/segmented';
import { DateInput } from '@/components/ui/date-input';
import { useCreateShift7Staff, useUpdateShift7Staff } from '@/hooks/queries/useShift7Staff';
import type {
  FacilityRow,
  Shift7AccessLevel,
  Shift7Qualification,
  Shift7StaffRole,
  StaffRow,
} from '@/types/database.types';

interface StaffFormDialogProps {
  /** null = create mode. */
  staff: StaffRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilities: FacilityRow[];
  /** Only a Shift7 admin may grant admin access — see the `roles-permissions` skill. */
  canGrantAdmin: boolean;
}

interface FormState {
  full_name: string;
  employee_id: string;
  role: Shift7StaffRole;
  qualification: Shift7Qualification;
  primary_facility: string;
  phone: string;
  email: string;
  status: 'active' | 'on_leave' | 'inactive';
  access_level: Shift7AccessLevel;
  weapon_license_expiry: string;
  weapon_refresh_expiry: string;
  medical_check_expiry: string;
}

const EMPTY_FORM: FormState = {
  full_name: '',
  employee_id: '',
  role: 'guard',
  qualification: 'none',
  primary_facility: '',
  phone: '',
  email: '',
  status: 'active',
  access_level: 'employee',
  weapon_license_expiry: '',
  weapon_refresh_expiry: '',
  medical_check_expiry: '',
};

const ACCESS_LEVEL_OPTIONS = [
  { value: 'admin', label: 'מנהל מערכת' },
  { value: 'scheduler', label: 'משבץ' },
  { value: 'employee', label: 'עובד' },
  { value: 'no_access', label: 'ללא גישה' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'פעיל' },
  { value: 'on_leave', label: 'בחופשה' },
  { value: 'inactive', label: 'לא פעיל' },
];

/**
 * Create + edit, one dialog: the form is the same shape either way and large
 * enough that duplicating it across two components (the way EditUserDialog /
 * InviteUserDialog split for the simpler user form) would just be repetition.
 * See the `form-dialogs` skill.
 */
export function StaffFormDialog({
  staff,
  open,
  onOpenChange,
  facilities,
  canGrantAdmin,
}: StaffFormDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const create = useCreateShift7Staff();
  const update = useUpdateShift7Staff();

  const isEditing = !!staff;
  const isPending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setTouched({});
    setForm(
      staff
        ? {
            full_name: staff.full_name,
            employee_id: staff.employee_id,
            role: staff.role,
            qualification: staff.qualification,
            primary_facility: staff.primary_facility,
            phone: staff.phone ?? '',
            email: staff.email ?? '',
            status: staff.status,
            access_level: staff.access_level,
            weapon_license_expiry: staff.weapon_license_expiry ?? '',
            weapon_refresh_expiry: staff.weapon_refresh_expiry ?? '',
            medical_check_expiry: staff.medical_check_expiry ?? '',
          }
        : EMPTY_FORM
    );
  }, [open, staff]);

  const qualificationOptions =
    form.role === 'guard'
      ? [
          { value: 'none', label: 'אין' },
          { value: 'shift_supervisor', label: 'אחמ"ש' },
        ]
      : [
          { value: 'none', label: 'אין' },
          { value: 'lead_dispatcher', label: 'אחראית מוקד' },
        ];

  // A scheduler must never see 'admin' as a selectable access level — not
  // even for a row that already has it, since the server rejects that write
  // outright and this option would just be a dead end.
  const accessLevelOptions = canGrantAdmin
    ? ACCESS_LEVEL_OPTIONS
    : ACCESS_LEVEL_OPTIONS.filter((o) => o.value !== 'admin');

  const errors = {
    full_name: touched.full_name && !form.full_name.trim(),
    primary_facility: touched.primary_facility && !form.primary_facility,
  };
  const canSubmit = !!form.full_name.trim() && !!form.primary_facility && !isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched({ full_name: true, primary_facility: true });
    if (!form.full_name.trim() || !form.primary_facility) return;

    // employee_id is immutable once set, so it's only ever part of the create
    // payload — the update payload never mentions the field at all.
    const commonFields = {
      full_name: form.full_name.trim(),
      role: form.role,
      qualification: form.qualification,
      primary_facility: form.primary_facility,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      status: form.status,
      access_level: form.access_level,
      weapon_license_expiry: form.weapon_license_expiry || null,
      weapon_refresh_expiry: form.weapon_refresh_expiry || null,
      medical_check_expiry: form.medical_check_expiry || null,
    };

    try {
      if (isEditing) {
        await update.mutateAsync({ id: staff.id, ...commonFields });
        toast.success('פרטי העובד עודכנו');
      } else {
        await create.mutateAsync({
          ...commonFields,
          employee_id: form.employee_id.trim() || undefined,
        });
        toast.success('העובד נוצר בהצלחה');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בשמירה');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'עריכת עובד' : 'הוספת איש צוות'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField
              className="md:col-span-2"
              icon={User}
              label="שם מלא"
              required
              error={errors.full_name && 'יש להזין שם מלא'}
            >
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                onBlur={() => setTouched((t) => ({ ...t, full_name: true }))}
              />
            </FormField>

            <FormField
              icon={Hash}
              label="מספר עובד"
              hint={isEditing ? 'קבוע — לא ניתן לשנות' : 'ריק = הפקה אוטומטית'}
            >
              <Input
                value={form.employee_id}
                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                disabled={isEditing}
              />
            </FormField>

            <FormField icon={Shield} label="תפקיד" required>
              <Segmented
                value={form.role}
                onChange={(v) => setForm({ ...form, role: v as Shift7StaffRole, qualification: 'none' })}
                options={[
                  { value: 'guard', label: 'מאבטח' },
                  { value: 'dispatcher', label: 'מוקדן' },
                ]}
                ariaLabel="תפקיד"
              />
            </FormField>

            <FormField icon={Shield} label="הסמכה">
              <Segmented
                value={form.qualification}
                onChange={(v) => setForm({ ...form, qualification: v as Shift7Qualification })}
                options={qualificationOptions}
                ariaLabel="הסמכה"
              />
            </FormField>

            <FormField
              icon={Building2}
              label="מתקן ראשי"
              required
              error={errors.primary_facility && 'יש לבחור מתקן'}
            >
              <Select
                value={form.primary_facility}
                onValueChange={(v) => setForm({ ...form, primary_facility: v })}
              >
                <SelectTrigger onBlur={() => setTouched((t) => ({ ...t, primary_facility: true }))}>
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

            <FormField icon={Phone} label="טלפון">
              <Input
                type="tel"
                dir="ltr"
                className="text-start"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </FormField>

            <FormField icon={Mail} label="אימייל">
              <Input
                type="email"
                dir="ltr"
                className="text-start"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </FormField>

            <FormField icon={Shield} label="סטטוס">
              <Segmented
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v as FormState['status'] })}
                options={STATUS_OPTIONS}
                ariaLabel="סטטוס"
              />
            </FormField>

            <FormField
              className="md:col-span-2"
              icon={ShieldAlert}
              label="הרשאות גישה למערכת"
              hint="קובע אילו עמודים ופעולות זמינים לעובד זה במודול Shift7"
            >
              <Segmented
                value={form.access_level}
                onChange={(v) => setForm({ ...form, access_level: v as Shift7AccessLevel })}
                options={accessLevelOptions}
                ariaLabel="הרשאות גישה"
              />
            </FormField>
          </div>

          <div className="rounded-lg border border-border/50 p-3">
            <p className="mb-3 text-xs font-semibold text-muted-foreground">תוקפים ואישורים</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField icon={ShieldAlert} label="תוקף רישיון נשק">
                <DateInput
                  value={form.weapon_license_expiry}
                  onChange={(v) => setForm({ ...form, weapon_license_expiry: v })}
                />
              </FormField>
              <FormField icon={ShieldAlert} label="תוקף רענון נשק">
                <DateInput
                  value={form.weapon_refresh_expiry}
                  onChange={(v) => setForm({ ...form, weapon_refresh_expiry: v })}
                />
              </FormField>
              <FormField icon={ShieldAlert} label="תוקף אישור רפואי">
                <DateInput
                  value={form.medical_check_expiry}
                  onChange={(v) => setForm({ ...form, medical_check_expiry: v })}
                />
              </FormField>
            </div>
          </div>

          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button type="submit" disabled={!canSubmit}>
              {isPending ? 'שומר...' : isEditing ? 'עדכן' : 'צור'} איש צוות
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
