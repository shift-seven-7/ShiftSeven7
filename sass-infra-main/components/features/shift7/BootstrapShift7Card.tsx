'use client';

import { useState } from 'react';
import { Building2, Shield, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Segmented } from '@/components/ui/segmented';
import { useShift7Bootstrap, type BootstrapStatus } from '@/hooks/queries/useShift7Bootstrap';
import { useShift7Facilities } from '@/hooks/queries/useShift7Facilities';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * First-run: a platform admin with no Shift7 staff row yet (and possibly no
 * facility either) sets both up in one step. See app/api/shift7/bootstrap.
 */
export function BootstrapShift7Card({ status }: { status: BootstrapStatus }) {
  const bootstrap = useShift7Bootstrap();
  const { data: facilities = [] } = useShift7Facilities();

  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'guard' | 'dispatcher'>('guard');
  const [facilityId, setFacilityId] = useState('');
  const [newFacilityName, setNewFacilityName] = useState('');
  const [newFacilityCode, setNewFacilityCode] = useState('');

  const needsNewFacility = !status.hasAnyFacility;
  const canSubmit =
    !!fullName.trim() &&
    (needsNewFacility ? !!newFacilityName.trim() && !!newFacilityCode.trim() : !!facilityId);

  async function handleSubmit() {
    try {
      await bootstrap.mutateAsync({
        full_name: fullName.trim(),
        role,
        ...(needsNewFacility
          ? { new_facility_name: newFacilityName.trim(), new_facility_code: newFacilityCode.trim() }
          : { primary_facility: facilityId }),
      });
      toast.success('ברוך הבא ל-Shift7!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בהצטרפות');
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-6">
        <div>
          <p className="font-medium text-foreground">ברוכים הבאים ל-Shift7</p>
          <p className="text-sm text-muted-foreground">
            {needsNewFacility
              ? 'זהו המתקן והעובד הראשונים במערכת — צור אותם כדי להתחיל.'
              : 'צור את רשומת העובד שלך כדי להתחיל להשתמש במודול.'}
          </p>
        </div>

        <FormField icon={User} label="שם מלא" required>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </FormField>

        <FormField icon={Shield} label="תפקיד">
          <Segmented
            value={role}
            onChange={(v) => setRole(v as 'guard' | 'dispatcher')}
            options={[
              { value: 'guard', label: 'מאבטח' },
              { value: 'dispatcher', label: 'מוקדן' },
            ]}
            ariaLabel="תפקיד"
          />
        </FormField>

        {needsNewFacility ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField icon={Building2} label="שם מתקן" required>
              <Input value={newFacilityName} onChange={(e) => setNewFacilityName(e.target.value)} />
            </FormField>
            <FormField icon={Building2} label="קוד מתקן" required>
              <Input value={newFacilityCode} onChange={(e) => setNewFacilityCode(e.target.value)} />
            </FormField>
          </div>
        ) : (
          <FormField icon={Building2} label="מתקן ראשי" required>
            <Select value={facilityId} onValueChange={setFacilityId}>
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
        )}

        <Button onClick={handleSubmit} disabled={!canSubmit || bootstrap.isPending} className="w-full">
          {bootstrap.isPending ? 'יוצר...' : 'התחל'}
        </Button>
      </CardContent>
    </Card>
  );
}
