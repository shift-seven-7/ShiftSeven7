'use client';

import { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Palette, type LucideIcon } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { PageTabs } from '@/components/ui/page-tabs';
import { AppearanceSettingsTab } from '@/components/settings/AppearanceSettingsTab';
import { usePermissions } from '@/lib/hooks/usePermissions';
import type { UserRole } from '@/types/roles';
import type { FeatureKey } from '@/lib/constants/features';

/**
 * Tenant system settings.
 *
 * Ships with one tab. The tab machinery — URL-synced selection, role gating,
 * module gating — is here so a project adds a settings surface by appending to
 * SETTINGS_TABS, not by rebuilding the page.
 */

interface SettingsTab {
  id: string;
  label: string;
  icon: LucideIcon;
  component: React.ComponentType;
  /** Omit for "any approved user". */
  roles?: UserRole[];
  /** Omit for infrastructure settings that are always present. */
  feature?: FeatureKey;
}

const SETTINGS_TABS: SettingsTab[] = [
  {
    id: 'appearance',
    label: 'עיצוב ומראה',
    icon: Palette,
    component: AppearanceSettingsTab,
  },

  // ── MODULE SETTINGS TABS GO HERE ──────────────────────────────────────────
  // { id: 'invoices', label: 'חשבוניות', icon: Receipt,
  //   component: InvoiceSettingsTab, roles: [USER_ROLES.ADMIN],
  //   feature: FEATURE_KEYS.INVOICES },
];

function SettingsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role, isFeatureEnabled } = usePermissions();

  const visibleTabs = SETTINGS_TABS.filter((tab) => {
    if (tab.roles && (!role || !tab.roles.includes(role))) return false;
    if (tab.feature && !isFeatureEnabled(tab.feature)) return false;
    return true;
  });

  const requested = searchParams.get('tab');
  const active =
    visibleTabs.find((tab) => tab.id === requested) ?? visibleTabs[0];

  function selectTab(id: string) {
    // Keeps the tab in the URL so a settings screen is linkable.
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (!active) {
    return (
      <PageLayout title="הגדרות מערכת">
        <p className="text-sm text-muted-foreground">אין הגדרות זמינות עבורך.</p>
      </PageLayout>
    );
  }

  const ActiveComponent = active.component;

  return (
    <PageLayout title="הגדרות מערכת">
      {visibleTabs.length > 1 && (
        <div className="mb-4">
          <PageTabs
            ariaLabel="הגדרות"
            tabs={visibleTabs.map((tab) => ({
              value: tab.id,
              label: tab.label,
              icon: tab.icon,
            }))}
            value={active.id}
            onChange={selectTab}
          />
        </div>
      )}

      <ActiveComponent />
    </PageLayout>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <PageLayout title="הגדרות מערכת" isLoading>
          {null}
        </PageLayout>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
