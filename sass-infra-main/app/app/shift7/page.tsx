'use client';

import Link from 'next/link';
import { ClipboardList, MapPin, Shield, Users } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import { useMyShift7Staff } from '@/hooks/queries/useMyShift7Staff';
import { useShift7Staff } from '@/hooks/queries/useShift7Staff';
import { useShift7Facilities } from '@/hooks/queries/useShift7Facilities';
import { useShift7Posts } from '@/hooks/queries/useShift7Posts';
import { useAllShift7EmployeeRequests } from '@/hooks/queries/useShift7EmployeeRequests';
import { useShift7BootstrapStatus } from '@/hooks/queries/useShift7Bootstrap';
import { BootstrapShift7Card } from '@/components/features/shift7/BootstrapShift7Card';
import Shift7MyAreaPage from './my-area/page';

interface StatTile {
  href: string;
  label: string;
  value: number;
  icon: typeof Users;
}

/**
 * Dashboard root ("לוח בקרה").
 *
 * The source app's Dashboard component (today's shift table, morning-
 * coverage shortage check, weekly-hours/requests tabs) depends on
 * shift_assignments end to end — one of the pages deliberately deferred
 * along with schedule/smart-schedule/unstaffed-shifts/published-schedule/
 * constraints-report. This is a lighter real overview (not a link list —
 * the persistent Shift7 nav in layout.tsx already covers every page) using
 * data this module already has; it gets replaced by the full port once
 * shift_assignments lands.
 */
export default function Shift7DashboardPage() {
  const { data: myStaff, isPending } = useMyShift7Staff();
  const isAdminOrScheduler = myStaff?.access_level === 'admin' || myStaff?.access_level === 'scheduler';

  const { data: allStaff = [] } = useShift7Staff();
  const { data: facilities = [] } = useShift7Facilities();
  const { data: posts = [] } = useShift7Posts();
  const { data: allRequests = [] } = useAllShift7EmployeeRequests(isAdminOrScheduler);
  const { data: bootstrapStatus, isPending: isBootstrapPending } = useShift7BootstrapStatus();

  if (isPending || (!myStaff && isBootstrapPending)) {
    return (
      <PageLayout title="Shift7">
        <p className="py-16 text-center text-sm text-muted-foreground">טוען...</p>
      </PageLayout>
    );
  }

  if (!myStaff && bootstrapStatus?.canBootstrap) {
    return (
      <PageLayout title="Shift7">
        <BootstrapShift7Card status={bootstrapStatus} />
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

  const activeStaff = allStaff.filter((s) => s.status === 'active');
  const pendingRequests = allRequests.filter((r) => r.status === 'pending').length;

  const tiles: StatTile[] = [
    { href: '/app/shift7/staff', label: 'אנשי צוות פעילים', value: activeStaff.length, icon: Users },
    { href: '/app/shift7/posts', label: 'עמדות פעילות', value: posts.filter((p) => p.status === 'active').length, icon: MapPin },
    { href: '/app/shift7/manage-requests', label: 'בקשות ממתינות', value: pendingRequests, icon: ClipboardList },
    { href: '/app/shift7/staff', label: 'מתקנים', value: facilities.length, icon: Shield },
  ];

  return (
    <PageLayout
      title="לוח בקרה"
      subtitle={new Date().toLocaleDateString('he-IL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href}>
            <Card className="h-full transition-colors hover:bg-foreground/[0.03]">
              <CardContent className="flex items-center gap-4 py-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <tile.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold tabular-nums text-foreground">{tile.value}</p>
                  <p className="text-sm text-muted-foreground">{tile.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </PageLayout>
  );
}
