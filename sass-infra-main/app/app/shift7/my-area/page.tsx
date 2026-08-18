'use client';

import Link from 'next/link';
import { CalendarClock, ShieldAlert, User } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMyShift7Staff } from '@/hooks/queries/useMyShift7Staff';
import { useMyShift7UpcomingShifts } from '@/hooks/queries/useMyShift7UpcomingShifts';
import { useShift7Facilities } from '@/hooks/queries/useShift7Facilities';

const CREDENTIALS = [
  { key: 'weapon_license_expiry', label: 'רישיון נשק' },
  { key: 'weapon_refresh_expiry', label: 'רענון נשק' },
  { key: 'medical_check_expiry', label: 'אישור רפואי' },
] as const;

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T12:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Simplified from the source app's my-area (which composed ProfileHeader /
 * UpcomingShifts / MonthlyHoursChart / CredentialsReminders sub-components,
 * not ported in this pass — see the report). Same information, one page.
 */
export default function Shift7MyAreaPage() {
  const { data: myStaff } = useMyShift7Staff();
  const { data: facilities = [] } = useShift7Facilities();
  const { data: upcomingShifts = [], isPending } = useMyShift7UpcomingShifts();

  const facilityName = myStaff ? facilities.find((f) => f.id === myStaff.primary_facility)?.name : undefined;

  return (
    <PageLayout title="האזור שלי" subtitle={myStaff ? `ברוך הבא, ${myStaff.full_name}` : undefined}>
      {!myStaff ? (
        <p className="py-16 text-center text-sm text-muted-foreground">אין לך רשומת עובד משויכת במערכת. פנה למנהל המערכת.</p>
      ) : (
        <div className="grid gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold">{myStaff.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  {myStaff.role === 'guard' ? 'מאבטח' : 'מוקדן'}
                  {facilityName ? ` · ${facilityName}` : ''}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" /> תוקפים ואישורים
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {CREDENTIALS.map(({ key, label }) => {
                  const value = myStaff[key];
                  if (!value) {
                    return (
                      <div key={key} className="rounded-lg border border-border/50 p-3 text-sm text-muted-foreground">
                        {label}: —
                      </div>
                    );
                  }
                  const days = daysUntil(value);
                  const variant = days < 0 ? 'destructive' : days <= 30 ? 'secondary' : 'outline';
                  return (
                    <div key={key} className="rounded-lg border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <Badge variant={variant} className="mt-1 text-xs">
                        {days < 0 ? 'פג תוקף' : `${days} ימים`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="h-4 w-4 text-muted-foreground" /> משמרות קרובות
              </h3>
              {isPending ? (
                <p className="py-4 text-center text-sm text-muted-foreground">טוען...</p>
              ) : upcomingShifts.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">אין משמרות פורסמות בקרוב</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {upcomingShifts.map((shift) => (
                    <li key={shift.id} className="flex items-center justify-between py-2 text-sm">
                      <span>{shift.date}</span>
                      <span className="font-mono text-xs text-muted-foreground">{shift.shift_code}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/app/shift7/shift-request">הגשת אילוצים</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/shift7/requests">הבקשות שלי</Link>
            </Button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
