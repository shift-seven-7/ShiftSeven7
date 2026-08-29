'use client';

import Link from 'next/link';
import { Plus, Wand2 } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenants } from '@/hooks/queries/useTenants';
import { PLAN_LABELS, STATUS_LABELS, TENANT_SETUP_STEPS } from '@/types/tenant.types';
import type { TenantListItem, TenantStatus } from '@/types/tenant.types';

const STATUS_VARIANT: Record<TenantStatus, 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  suspended: 'outline',
  pending: 'secondary',
  deleted: 'outline',
};

/** How far through the 8-step provisioning wizard this tenant got. */
function setupProgress(tenant: TenantListItem): string | null {
  const steps = tenant.setup_status?.steps;
  if (!steps) return null;

  const done = TENANT_SETUP_STEPS.filter((step) => steps[step]).length;
  if (done === TENANT_SETUP_STEPS.length) return null;
  return `${done}/${TENANT_SETUP_STEPS.length}`;
}

export default function TenantsPage() {
  const { data, isPending } = useTenants();
  const tenants = data?.tenants ?? [];

  return (
    <PageLayout
      title="ניהול טננטים"
      subtitle={tenants.length > 0 ? `${tenants.length} טננטים` : undefined}
      actions={
        <>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/app/admin/tenants/new">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">רישום ידני</span>
            </Link>
          </Button>
          <Button asChild className="gap-2">
            <Link href="/app/admin/tenants/new-automated">
              <Wand2 className="h-4 w-4" />
              <span className="hidden sm:inline">הקמה אוטומטית</span>
            </Link>
          </Button>
        </>
      }
    >
      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[1fr_160px_120px_110px_90px] gap-4 border-b border-border/60 px-4 py-3 text-xs font-semibold text-muted-foreground md:grid">
          <span>שם</span>
          <span>סאב-דומיין</span>
          <span>מנוי</span>
          <span>סטטוס</span>
          <span>הקמה</span>
        </div>

        {isPending ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : tenants.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            אין עדיין טננטים במערכת
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {tenants.map((tenant) => {
              const progress = setupProgress(tenant);

              return (
                <li key={tenant.id}>
                  <Link
                    href={`/app/admin/tenants/${tenant.id}`}
                    className="grid grid-cols-1 gap-1 px-4 py-3 text-sm transition-colors hover:bg-card-elevated md:grid-cols-[1fr_160px_120px_110px_90px] md:items-center md:gap-4"
                  >
                    <span className="font-medium text-foreground">
                      {tenant.name_he || tenant.name}
                    </span>

                    <span className="text-muted-foreground" dir="ltr">
                      {tenant.subdomain}
                    </span>

                    <span>
                      <Badge variant="secondary">{PLAN_LABELS[tenant.plan_type]}</Badge>
                    </span>

                    <span>
                      <Badge variant={STATUS_VARIANT[tenant.status]}>
                        {STATUS_LABELS[tenant.status]}
                      </Badge>
                    </span>

                    <span className="text-xs text-muted-foreground">
                      {progress ? `${progress} שלבים` : 'הושלמה'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </PageLayout>
  );
}
