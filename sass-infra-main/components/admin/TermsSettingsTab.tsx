'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUpdateTenantSettings } from '@/hooks/queries/useTenantSettings';
import type { TenantPublic } from '@/lib/tenant/serialize';

/**
 * Legal copy for a tenant.
 *
 * Saving re-stamps `terms_version` server-side, which is what makes existing
 * users see the acceptance prompt again — so edit the text only when you
 * actually want everyone to re-accept.
 */
export function TermsSettingsTab({ tenant }: { tenant: TenantPublic }) {
  const update = useUpdateTenantSettings();

  const [terms, setTerms] = useState('');
  const [privacy, setPrivacy] = useState('');

  useEffect(() => {
    setTerms(tenant.settings.terms_of_service ?? '');
    setPrivacy(tenant.settings.privacy_policy ?? '');
  }, [tenant.settings.terms_of_service, tenant.settings.privacy_policy]);

  const isDirty =
    terms !== (tenant.settings.terms_of_service ?? '') ||
    privacy !== (tenant.settings.privacy_policy ?? '');

  async function handleSave() {
    try {
      await update.mutateAsync({
        targetTenantId: tenant.id,
        terms_of_service: terms,
        privacy_policy: privacy,
      });
      toast.success('תנאי השימוש נשמרו. כל המשתמשים יתבקשו לאשר מחדש.');
    } catch {
      toast.error('שמירת תנאי השימוש נכשלה');
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">תנאי שימוש</CardTitle>
          <CardDescription>
            {tenant.settings.terms_version
              ? `גרסה נוכחית: ${tenant.settings.terms_version}`
              : 'טרם הוגדרו תנאי שימוש'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Textarea
            rows={12}
            value={terms}
            onChange={(event) => setTerms(event.target.value)}
            placeholder="הטקסט שיוצג למשתמשים באישור תנאי השימוש"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">מדיניות פרטיות</CardTitle>
        </CardHeader>

        <CardContent>
          <Textarea
            rows={12}
            value={privacy}
            onChange={(event) => setPrivacy(event.target.value)}
            placeholder="מדיניות הפרטיות של הארגון"
          />
        </CardContent>
      </Card>

      <div className="flex flex-row-reverse">
        <Button onClick={handleSave} disabled={!isDirty || update.isPending}>
          {update.isPending ? 'שומר...' : 'שמירה'}
        </Button>
      </div>
    </div>
  );
}
