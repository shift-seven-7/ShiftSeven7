'use client';

import Link from 'next/link';
import {
  CalendarClock,
  ClipboardList,
  MapPin,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import { useMyShift7Staff } from '@/hooks/queries/useMyShift7Staff';
import { useShift7Staff } from '@/hooks/queries/useShift7Staff';
import { useAllShift7EmployeeRequests } from '@/hooks/queries/useShift7EmployeeRequests';
import Shift7MyAreaPage from './my-area/page';

interface ShortcutCard {
  href: string;
  label: string;
  description: string;
  icon: typeof Users;
}

const ADMIN_SHORTCUTS: ShortcutCard[] = [
  { href: '/app/shift7/staff', label: 'צוות העובדים', description: 'ניהול מאבטחים ומוקדנים', icon: Users },
  { href: '/app/shift7/posts', label: 'עמדות שמירה', description: 'עמדות סטטיות ומוקדי בקרה', icon: MapPin },
  { href: '/app/shift7/shift-templates', label: 'תבניות משמרת', description: 'קודי משמרת ושעות', icon: CalendarClock },
  {
    href: '/app/shift7/staffing-requirements',
    label: 'תקינת כיסוי',
    description: 'כמות עובדים נדרשת למשמרת',
    icon: SlidersHorizontal,
  },
  {
    href: '/app/shift7/manage-requests',
    label: 'ניהול בקשות',
    description: 'אישור ודחיית בקשות עובדים',
    icon: ClipboardList,
  },
];

/**
 * Dashboard root. The source app rendered a chart-heavy admin Dashboard
 * component (not ported — out of scope for this pass) or, for a plain
 * employee, the my-area page inline at the same route. This keeps the
 * second half of that behavior (employee → my-area) and replaces the first
 * half with a lightweight shortcut grid rather than the full chart
 * dashboard — see the report.
 */
export default function Shift7DashboardPage() {
  const { data: myStaff, isPending } = useMyShift7Staff();
  const { data: allStaff = [] } = useShift7Staff();
  const { data: allRequests = [] } = useAllShift7EmployeeRequests();

  if (isPending) {
    return (
      <PageLayout title="Shift7">
        <p className="py-16 text-center text-sm text-muted-foreground">טוען...</p>
      </PageLayout>
    );
  }

  if (!myStaff || myStaff.access_level === 'no_access') {
    return (
      <PageLayout title="Shift7">
        <p className="py-16 text-center text-sm text-muted-foreground">אין לך הרשאת גישה למודול. פנה למנהל המערכת.</p>
      </PageLayout>
    );
  }

  if (myStaff.access_level === 'employee') {
    return <Shift7MyAreaPage />;
  }

  const pendingRequests = allRequests.filter((r) => r.status === 'pending').length;

  return (
    <PageLayout title="Shift7" subtitle={`${allStaff.length} אנשי צוות · ${pendingRequests} בקשות ממתינות`}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_SHORTCUTS.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full transition-colors hover:bg-foreground/[0.03]">
              <CardContent className="flex items-center gap-4 py-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </PageLayout>
  );
}
