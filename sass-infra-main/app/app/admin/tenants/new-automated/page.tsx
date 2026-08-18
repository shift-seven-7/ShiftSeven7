'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Building2, Check, Globe, Link2, Mail, MapPin, Tag, X } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Segmented } from '@/components/ui/segmented';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProvisionTenant } from '@/hooks/queries/useTenantSetup';
import { PLAN_LABELS, SETUP_STEP_LABELS } from '@/types/tenant.types';
import type { AutomationResult } from '@/lib/services/tenant-automation';
import type { TenantPlan } from '@/types/tenant.types';
import { BASE_DOMAIN } from '@/lib/constants/domain';

const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/** Supabase regions worth offering; extend freely. */
const REGIONS = [
  { value: 'eu-central-1', label: 'פרנקפורט' },
  { value: 'eu-west-2', label: 'לונדון' },
  { value: 'us-east-1', label: 'וירג׳יניה' },
];

/**
 * One-click provisioning.
 *
 * The run takes minutes (Supabase project creation dominates), so the result is
 * rendered step by step rather than as a single success/failure — a partial run
 * is a resumable state, not a dead end.
 */
export default function NewAutomatedTenantPage() {
  const router = useRouter();
  const provision = useProvisionTenant();

  const [subdomain, setSubdomain] = useState('');
  const [name, setName] = useState('');
  const [region, setRegion] = useState(REGIONS[0].value);
  const [plan, setPlan] = useState<TenantPlan>('standard');
  const [adminEmail, setAdminEmail] = useState('');
  const [existingProjectRef, setExistingProjectRef] = useState('');
  const [result, setResult] = useState<AutomationResult | null>(null);

  const canSubmit = SUBDOMAIN_RE.test(subdomain) && !!name && !provision.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    try {
      const outcome = await provision.mutateAsync({
        subdomain,
        name,
        region,
        plan_type: plan,
        adminEmail: adminEmail || undefined,
        existingProjectRef: existingProjectRef || undefined,
      });
      setResult(outcome);
    } catch {
      // Error toast comes from the mutation cache.
    }
  }

  if (result) {
    return (
      <PageLayout
        title={result.completed ? 'ההקמה הושלמה' : 'ההקמה נעצרה'}
        subtitle={`${subdomain}.${BASE_DOMAIN}`}
      >
        <Card>
          <CardContent className="pt-6">
            <ul className="space-y-3">
              {result.steps.map((step) => (
                <li key={step.step} className="flex items-start gap-3">
                  <span
                    className={
                      step.ok
                        ? 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-background text-success'
                        : 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-error-background text-error'
                    }
                  >
                    {step.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </span>

                  <div className="min-w-0">
                    <p className="text-sm font-medium">{SETUP_STEP_LABELS[step.step]}</p>
                    <p className="text-xs text-muted-foreground">{step.message}</p>
                  </div>
                </li>
              ))}
            </ul>

            {!result.completed && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning-background p-3 text-sm text-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  ההקמה נעצרה. תקן את הסיבה והרץ מחדש את השלב שנכשל דרך אשף ההקמה —
                  אין צורך להתחיל מהתחלה.
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-4 flex flex-row-reverse gap-2">
          {result.tenantId && (
            <Button onClick={() => router.push(`/app/admin/tenants/${result.tenantId}/setup`)}>
              לאשף ההקמה
            </Button>
          )}
          <Button variant="outline" onClick={() => router.push('/app/admin/tenants')}>
            לרשימת הטננטים
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="הקמת טננט אוטומטית"
      subtitle="יצירת פרויקט Supabase, הרצת מיגרציות, הגדרת דומיין ומנהל ראשון"
    >
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
              hint={subdomain ? `${subdomain}.${BASE_DOMAIN}` : 'לא ניתן לשינוי לאחר היצירה'}
            >
              <Input
                dir="ltr"
                className="text-start"
                value={subdomain}
                onChange={(event) => setSubdomain(event.target.value.toLowerCase())}
                autoFocus
              />
            </FormField>

            <FormField label="שם הארגון" icon={Building2} required>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </FormField>

            <FormField label="אזור" icon={MapPin} required>
              <Segmented options={REGIONS} value={region} onChange={setRegion} />
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

            <FormField
              label="אימייל מנהל ראשון"
              icon={Mail}
              hint="ייווצר עם הרשאת מנהל מערכת"
            >
              <Input
                type="email"
                dir="ltr"
                className="text-start"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
              />
            </FormField>

            <FormField
              label="Project Ref קיים"
              icon={Link2}
              hint="השאר ריק כדי ליצור פרויקט חדש. מלא אם כבר יצרת אחד ידנית."
            >
              <Input
                dir="ltr"
                className="text-start"
                value={existingProjectRef}
                onChange={(event) => setExistingProjectRef(event.target.value.trim())}
              />
            </FormField>
          </CardContent>
        </Card>

        <div className="flex flex-row-reverse gap-2">
          <Button type="submit" disabled={!canSubmit}>
            {provision.isPending ? 'מקים... (עשוי לקחת מספר דקות)' : 'התחלת הקמה'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            ביטול
          </Button>
        </div>
      </form>
    </PageLayout>
  );
}
