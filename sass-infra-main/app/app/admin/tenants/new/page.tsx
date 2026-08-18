'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Globe, KeyRound, Link2, Shield, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Segmented } from '@/components/ui/segmented';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateTenant } from '@/hooks/queries/useTenants';
import { PLAN_LABELS } from '@/types/tenant.types';
import type { TenantPlan } from '@/types/tenant.types';
import { BASE_DOMAIN } from '@/lib/constants/domain';

const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/**
 * Registers a Supabase project you created by hand.
 *
 * Use this when the Supabase org has no free project slot, or when the project
 * already exists. The alternative — /app/admin/tenants/new-automated — creates
 * the project too.
 */
export default function NewTenantPage() {
  const router = useRouter();
  const create = useCreateTenant();

  const [subdomain, setSubdomain] = useState('');
  const [name, setName] = useState('');
  const [nameHe, setNameHe] = useState('');
  const [projectRef, setProjectRef] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [serviceKey, setServiceKey] = useState('');
  const [plan, setPlan] = useState<TenantPlan>('standard');
  const [touched, setTouched] = useState(false);

  const subdomainError =
    touched && subdomain && !SUBDOMAIN_RE.test(subdomain)
      ? 'אותיות קטנות באנגלית, ספרות ומקפים בלבד'
      : null;

  const canSubmit =
    SUBDOMAIN_RE.test(subdomain) && !!name && !!projectRef && !!supabaseUrl && !!anonKey;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit) return;

    try {
      const { tenant } = await create.mutateAsync({
        subdomain,
        name,
        name_he: nameHe || undefined,
        supabase_project_ref: projectRef,
        supabase_url: supabaseUrl,
        supabase_anon_key: anonKey,
        supabase_service_role_key: serviceKey || undefined,
        plan_type: plan,
      });

      toast.success('הטננט נרשם בהצלחה');
      router.push(`/app/admin/tenants/${tenant.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'רישום הטננט נכשל');
    }
  }

  return (
    <PageLayout title="רישום טננט קיים" subtitle="חיבור פרויקט Supabase שכבר נוצר">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">פרטי הארגון</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              label="סאב-דומיין"
              icon={Globe}
              required
              error={subdomainError}
              hint={subdomain ? `${subdomain}.${BASE_DOMAIN}` : 'לא ניתן לשינוי לאחר היצירה'}
            >
              <Input
                dir="ltr"
                className="text-start"
                value={subdomain}
                onChange={(event) => setSubdomain(event.target.value.toLowerCase())}
                onBlur={() => setTouched(true)}
                autoFocus
              />
            </FormField>

            <FormField label="שם (אנגלית)" icon={Building2} required>
              <Input
                dir="ltr"
                className="text-start"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>

            <FormField label="שם בעברית" icon={Building2}>
              <Input value={nameHe} onChange={(event) => setNameHe(event.target.value)} />
            </FormField>

            <FormField label="מנוי" icon={Tag} required>
              <Segmented
                options={(Object.keys(PLAN_LABELS) as TenantPlan[]).map((value) => ({
                  value,
                  label: PLAN_LABELS[value],
                }))}
                value={plan}
                onChange={setPlan}
              />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">חיבור ל-Supabase</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Project Ref"
              icon={Link2}
              required
              hint="20 אותיות, מתוך כתובת הפרויקט ב-Supabase"
            >
              <Input
                dir="ltr"
                className="text-start"
                value={projectRef}
                onChange={(event) => setProjectRef(event.target.value.trim())}
              />
            </FormField>

            <FormField label="Project URL" icon={Globe} required>
              <Input
                dir="ltr"
                className="text-start"
                placeholder="https://xxx.supabase.co"
                value={supabaseUrl}
                onChange={(event) => setSupabaseUrl(event.target.value.trim())}
              />
            </FormField>

            <FormField
              label="Publishable / anon key"
              icon={KeyRound}
              required
              hint="נשמר מוצפן במאגר"
            >
              <Input
                dir="ltr"
                className="text-start"
                value={anonKey}
                onChange={(event) => setAnonKey(event.target.value.trim())}
              />
            </FormField>

            <FormField
              label="Service role key"
              icon={Shield}
              hint="נדרש לניהול משתמשים והזמנות. נשמר מוצפן ולא נשלח לדפדפן"
            >
              <Input
                type="password"
                dir="ltr"
                className="text-start"
                value={serviceKey}
                onChange={(event) => setServiceKey(event.target.value.trim())}
              />
            </FormField>
          </CardContent>
        </Card>

        <div className="flex flex-row-reverse gap-2">
          <Button type="submit" disabled={!canSubmit || create.isPending}>
            {create.isPending ? 'רושם...' : 'רישום הטננט'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            ביטול
          </Button>
        </div>
      </form>
    </PageLayout>
  );
}
