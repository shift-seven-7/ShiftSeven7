'use client';

import { Suspense, use } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FileText, ScrollText, Settings2, Wand2 } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { PageTabs } from '@/components/ui/page-tabs';
import { Button } from '@/components/ui/button';
import { TenantDetailsTab } from '@/components/admin/TenantDetailsTab';
import { TenantSettingsTab } from '@/components/admin/TenantSettingsTab';
import { TermsSettingsTab } from '@/components/admin/TermsSettingsTab';
import { useTenant } from '@/hooks/queries/useTenants';

const TABS = [
  { value: 'details', label: 'פרטי טננט', icon: FileText },
  { value: 'client-settings', label: 'הגדרות לקוח', icon: Settings2 },
  { value: 'terms', label: 'תנאי שימוש', icon: ScrollText },
] as const;

type TabValue = (typeof TABS)[number]['value'];

function TenantDetail({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data, isPending } = useTenant(id);
  const tenant = data?.tenant;

  const requested = searchParams.get('tab') as TabValue | null;
  const active: TabValue = TABS.some((tab) => tab.value === requested)
    ? (requested as TabValue)
    : 'details';

  function selectTab(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (isPending || !tenant) {
    return (
      <PageLayout title="טננט" isLoading={isPending}>
        {!isPending && <p className="text-sm text-muted-foreground">הטננט לא נמצא.</p>}
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={tenant.name_he || tenant.name}
      subtitle={tenant.subdomain}
      actions={
        <Button asChild variant="outline" className="gap-2">
          <Link href={`/app/admin/tenants/${tenant.id}/setup`}>
            <Wand2 className="h-4 w-4" />
            <span className="hidden sm:inline">אשף הקמה</span>
          </Link>
        </Button>
      }
    >
      <div className="mb-4">
        <PageTabs ariaLabel="הגדרות טננט" tabs={[...TABS]} value={active} onChange={selectTab} />
      </div>

      {active === 'details' && <TenantDetailsTab tenant={tenant} />}
      {active === 'client-settings' && <TenantSettingsTab tenant={tenant} />}
      {active === 'terms' && <TermsSettingsTab tenant={tenant} />}
    </PageLayout>
  );
}

export default function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <Suspense
      fallback={
        <PageLayout title="טננט" isLoading>
          {null}
        </PageLayout>
      }
    >
      <TenantDetail id={id} />
    </Suspense>
  );
}
