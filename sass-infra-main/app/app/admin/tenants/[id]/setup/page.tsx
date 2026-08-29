'use client';

import { use, useState } from 'react';
import { AlertTriangle, Check, Play, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRunSetupStep, useTenantSetup } from '@/hooks/queries/useTenantSetup';
import { SETUP_STEP_LABELS } from '@/types/tenant.types';
import type { TenantSetupStep } from '@/types/tenant.types';

/**
 * The eight-step provisioning wizard.
 *
 * Each step can be re-run on its own. That is the whole point: provisioning
 * spans Supabase, DNS and the registry, and a transient failure in one of them
 * should cost a retry — not a fresh billable project.
 */
export default function TenantSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isPending } = useTenantSetup(id);
  const runStep = useRunSetupStep(id);

  const [running, setRunning] = useState<TenantSetupStep | null>(null);

  async function handleRun(step: TenantSetupStep) {
    setRunning(step);
    try {
      const result = await runStep.mutateAsync({ step });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'הרצת השלב נכשלה');
    } finally {
      setRunning(null);
    }
  }

  return (
    <PageLayout
      title="אשף הקמה"
      subtitle={data ? `${data.subdomain} · ${data.projectRef}` : undefined}
      isLoading={isPending}
    >
      {data?.lastError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-error-background p-3 text-sm text-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{data.lastError}</span>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <ol className="divide-y divide-border/60">
            {data?.steps.map(({ step, done }, index) => (
              <li
                key={step}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span
                  className={
                    done
                      ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success-background text-success'
                      : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card-elevated text-muted-foreground'
                  }
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {index + 1}. {SETUP_STEP_LABELS[step]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {done ? 'הושלם' : 'לא הורץ'}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={running !== null}
                  onClick={() => handleRun(step)}
                >
                  <Play className="h-3.5 w-3.5" />
                  {running === step ? 'מריץ...' : done ? 'הרצה מחדש' : 'הרצה'}
                </Button>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        כל שלב אידמפוטנטי — הרצה חוזרת של שלב שכבר הצליח בטוחה.
      </p>
    </PageLayout>
  );
}
