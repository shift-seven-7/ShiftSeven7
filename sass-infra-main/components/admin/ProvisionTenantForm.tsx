'use client';

import { useState } from 'react';
import { Building2, Check, Globe, KeyRound, Link2, Mail, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Segmented } from '@/components/ui/segmented';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { BASE_DOMAIN, tenantHref } from '@/lib/constants/domain';
import { SETUP_STEP_LABELS } from '@/types/tenant.types';
import type { AutomationResult } from '@/lib/services/tenant-automation';

/**
 * The provisioning form, shared by every surface that can create a tenant.
 *
 * Three callers, one form: /bootstrap (first run, token-gated), /backoffice
 * (master session) and the in-tenant console. They differ only in which
 * endpoint they post to and whether a setup token is required, so that is all
 * this component takes.
 *
 * It owns the result rendering too, because the most important thing on this
 * screen is what to do after a PARTIAL run — and getting that wrong costs a
 * second billable Supabase project.
 */

const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/** Extend freely — these are just the ones worth offering by default. */
const REGIONS = [
  { value: 'eu-central-1', label: 'פרנקפורט' },
  { value: 'eu-west-2', label: 'לונדון' },
  { value: 'us-east-1', label: 'וירג׳יניה' },
];

export function ProvisionTenantForm({
  endpoint,
  includeToken = false,
  onProvisioned,
}: {
  endpoint: string;
  /** /bootstrap requires BOOTSTRAP_TOKEN; an authenticated caller does not. */
  includeToken?: boolean;
  onProvisioned?: (result: AutomationResult) => void;
}) {
  const [token, setToken] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [name, setName] = useState('');
  const [region, setRegion] = useState(REGIONS[0].value);
  const [adminEmail, setAdminEmail] = useState('');
  const [existingProjectRef, setExistingProjectRef] = useState('');

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AutomationResult | null>(null);

  const canSubmit =
    (!includeToken || !!token) &&
    SUBDOMAIN_RE.test(subdomain) &&
    !!name.trim() &&
    !isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setIsPending(true);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(includeToken ? { token } : {}),
          subdomain,
          name,
          region,
          adminEmail: adminEmail || undefined,
          existingProjectRef: existingProjectRef || undefined,
        }),
      });

      const json = await response.json();
      // 207 is a partial run — still a result worth rendering step by step.
      if (!response.ok && response.status !== 207) {
        throw new Error(json.error || 'ההקמה נכשלה');
      }

      setResult(json as AutomationResult);
      onProvisioned?.(json as AutomationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ההקמה נכשלה');
    } finally {
      setIsPending(false);
    }
  }

  if (result) {
    return <ProvisionResult result={result} subdomain={subdomain} />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">פרטי הארגון</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-2">
          {includeToken && (
            <FormField label="קוד הקמה" icon={KeyRound} required hint="הערך של BOOTSTRAP_TOKEN">
              <Input
                type="password"
                dir="ltr"
                className="text-start"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                autoFocus
              />
            </FormField>
          )}

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
              autoFocus={!includeToken}
            />
          </FormField>

          <FormField label="שם הארגון" icon={Building2} required>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </FormField>

          <FormField label="אזור" icon={MapPin} required>
            <Segmented options={REGIONS} value={region} onChange={setRegion} />
          </FormField>

          <FormField label="אימייל מנהל ראשון" icon={Mail} hint="ייווצר עם הרשאת מנהל מערכת">
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
            hint="השאר ריק כדי ליצור פרויקט חדש"
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

      {error && <p className="text-sm text-error">{error}</p>}

      <Button type="submit" className="w-full" disabled={!canSubmit}>
        {isPending ? 'מקים... (עשוי לקחת מספר דקות)' : 'התחלת הקמה'}
      </Button>
    </form>
  );
}

function ProvisionResult({
  result,
  subdomain,
}: {
  result: AutomationResult;
  subdomain: string;
}) {
  const tenantUrl = tenantHref(subdomain);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {result.completed ? 'ההקמה הושלמה' : 'ההקמה נעצרה'}
          </CardTitle>
        </CardHeader>

        <CardContent>
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
        </CardContent>
      </Card>

      {result.completed ? (
        <Notice tone="success" title="הטננט מוכן">
          הכתובת שלו היא{' '}
          <a href={tenantUrl} dir="ltr" className="font-medium underline">
            {tenantUrl}
          </a>
          . המנהל שהוגדר נוצר ללא סיסמה — הכניסה הראשונה היא דרך ״שכחתי סיסמה״ או דרך
          ספק התחברות שהוגדר.
        </Notice>
      ) : (
        <Notice tone="warning" title="ההקמה לא הושלמה">
          {result.projectRef ? (
            <span>
              פרויקט ה-Supabase{' '}
              <code dir="ltr" className="font-medium">
                {result.projectRef}
              </code>{' '}
              כבר נוצר. תקן את הסיבה והרץ שוב — אבל{' '}
              <strong>הזן אותו בשדה &quot;Project Ref קיים&quot;</strong>, אחרת ייווצר
              פרויקט שני שעולה כסף.
            </span>
          ) : (
            <span>תקן את הסיבה והרץ שוב. שום שלב לא בוטל.</span>
          )}
        </Notice>
      )}
    </div>
  );
}
