import { TENANT_SETUP_STEPS, type TenantSetupStep, type TenantPlan } from '@/types/tenant.types';
import { getTenantBySubdomain } from '@/lib/supabase/master-client';
import { recordStep, runStep, type StepContext } from './tenant-setup-steps';

/**
 * End-to-end tenant provisioning: runs the eight setup steps in order.
 *
 * Stops at the first failure and returns what completed. Nothing is rolled
 * back — a half-provisioned tenant is a resumable state, and the setup wizard
 * exists precisely so an operator can re-run the step that failed instead of
 * starting over with a fresh billable project.
 */

export interface AutomationInput {
  subdomain: string;
  name: string;
  region?: string;
  plan?: TenantPlan;
  adminEmail?: string;
  /** Skips project creation and adopts a project you already made. */
  existingProjectRef?: string;
}

export interface StepOutcome {
  step: TenantSetupStep;
  ok: boolean;
  message: string;
}

export interface AutomationResult {
  tenantId?: string;
  projectRef?: string;
  steps: StepOutcome[];
  completed: boolean;
}

export async function provisionTenant(input: AutomationInput): Promise<AutomationResult> {
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(input.subdomain)) {
    throw new Error('הסאב-דומיין יכול להכיל אותיות קטנות, ספרות ומקפים בלבד');
  }

  const existing = await getTenantBySubdomain(input.subdomain);
  if (existing) throw new Error(`הסאב-דומיין "${input.subdomain}" כבר בשימוש`);

  let context: StepContext = {
    subdomain: input.subdomain,
    name: input.name,
    region: input.region,
    plan: input.plan,
    adminEmail: input.adminEmail,
    projectRef: input.existingProjectRef,
  };

  const steps: StepOutcome[] = [];
  let hasBackfilled = false;

  for (const step of TENANT_SETUP_STEPS) {
    try {
      const result = await runStep(step, context);
      context = result.context;
      steps.push({ step, ok: true, message: result.message });

      // The first steps run before there is a tenant row to record against.
      // Once `tenant_registered` creates one, backfill everything that already
      // succeeded so the wizard shows real progress rather than starting at
      // step 6.
      if (context.tenantId && !hasBackfilled) {
        for (const earlier of steps) {
          await recordStep(context.tenantId, earlier.step, earlier.ok);
        }
        hasBackfilled = true;
      } else if (context.tenantId) {
        await recordStep(context.tenantId, step, true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      steps.push({ step, ok: false, message });

      if (context.tenantId) {
        await recordStep(context.tenantId, step, false, message);
      }

      return {
        tenantId: context.tenantId,
        projectRef: context.projectRef,
        steps,
        completed: false,
      };
    }
  }

  return {
    tenantId: context.tenantId,
    projectRef: context.projectRef,
    steps,
    completed: true,
  };
}
