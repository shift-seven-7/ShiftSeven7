'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ImageIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUpdateTenantSettings } from '@/hooks/queries/useTenantSettings';
import { useUploadFile } from '@/hooks/queries/useUploadFile';
import { getFeatureFlags } from '@/lib/constants/features';
import { BUCKETS } from '@/lib/storage/config';
import type { TenantPublic } from '@/lib/tenant/serialize';

/**
 * "Client settings" — what an admin configures per tenant: branding and which
 * modules the tenant has.
 *
 * The module matrix is binary (on/off). It reads its rows from
 * getFeatureFlags(), so a newly registered module appears here with no change
 * to this file.
 */
export function TenantSettingsTab({ tenant }: { tenant: TenantPublic }) {
  const update = useUpdateTenantSettings();
  const upload = useUploadFile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const flags = getFeatureFlags();

  // `features` absent means "everything" — that is the default for a new
  // tenant, and it is how a tenant keeps receiving newly added modules.
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [hasExplicitPackage, setHasExplicitPackage] = useState(false);

  useEffect(() => {
    const stored = tenant.settings.features;
    setHasExplicitPackage(Array.isArray(stored));
    setEnabled(new Set(stored ?? flags.map((flag) => flag.key)));
    // Re-syncs whenever the server hands back a new settings object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.settings.features]);

  async function saveFeatures(next: Set<string>) {
    setEnabled(next);
    setHasExplicitPackage(true);

    try {
      await update.mutateAsync({
        targetTenantId: tenant.id,
        features: Array.from(next),
      });
    } catch {
      // Roll back to what the server still holds.
      setEnabled(new Set(tenant.settings.features ?? flags.map((flag) => flag.key)));
      toast.error('שמירת המודולים נכשלה');
    }
  }

  function toggleFeature(key: string, isOn: boolean) {
    const next = new Set(enabled);
    if (isOn) next.add(key);
    else next.delete(key);
    saveFeatures(next);
  }

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const uploaded = await upload.mutateAsync({
        file,
        bucket: BUCKETS.AVATARS,
        entityType: 'tenant_logo',
        entityId: tenant.id,
      });

      await update.mutateAsync({ targetTenantId: tenant.id, logo_url: uploaded.url });
      toast.success('הלוגו עודכן');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'העלאת הלוגו נכשלה');
    } finally {
      event.target.value = '';
    }
  }

  async function handleLogoRemove() {
    try {
      await update.mutateAsync({ targetTenantId: tenant.id, logo_url: '' });
      toast.success('הלוגו הוסר');
    } catch {
      toast.error('הסרת הלוגו נכשלה');
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">לוגו</CardTitle>
          <CardDescription>מוצג בתפריט הצד של הלקוח</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-card-elevated">
            {tenant.settings.logo_url ? (
              <Image
                src={tenant.settings.logo_url}
                alt=""
                width={80}
                height={80}
                className="h-full w-full object-contain"
                unoptimized
              />
            ) : (
              <ImageIcon className="h-7 w-7 text-muted-foreground/50" />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={upload.isPending}
            >
              {upload.isPending ? 'מעלה...' : 'העלאת לוגו'}
            </Button>

            {tenant.settings.logo_url && (
              <Button
                type="button"
                variant="ghost"
                className="gap-2 text-destructive hover:text-destructive"
                onClick={handleLogoRemove}
              >
                <Trash2 className="h-4 w-4" />
                הסרה
              </Button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoChange}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">מודולים</CardTitle>
          <CardDescription>
            {hasExplicitPackage
              ? 'המודולים שהארגון רכש'
              : 'לא הוגדרה חבילה — הארגון מקבל את כל המודולים, כולל חדשים'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {flags.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 py-10 text-center">
              <p className="text-sm text-muted-foreground">לא הוגדרו מודולים במערכת</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                מודולים נרשמים ב-lib/constants/features.ts
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {flags.map((flag) => (
                <li
                  key={flag.key}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {/* Sub-features are indented under their parent. */}
                      {flag.parent && <span className="text-muted-foreground">↳ </span>}
                      {flag.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{flag.description}</p>
                  </div>

                  <Switch
                    checked={enabled.has(flag.key)}
                    onCheckedChange={(isOn) => toggleFeature(flag.key, isOn)}
                    disabled={update.isPending}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
