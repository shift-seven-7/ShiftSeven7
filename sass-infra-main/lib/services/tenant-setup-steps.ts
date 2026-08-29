import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  configureAuth,
  createBucket,
  createProject,
  executeSql,
  generateSecurePassword,
  getProjectCost,
  getProjectCredentials,
  listBuckets,
  waitForProjectReady,
} from './supabase-management';
import { addSubdomainRecord, isDnsAutomationConfigured } from './vercel-api';
import { getMigrationFilenames, readMigrationFile } from '@/lib/constants/migrations';
import { DEFAULT_STORAGE_BUCKETS } from '@/lib/storage/config';
import { createTenant, getTenantById, updateTenant } from '@/lib/supabase/master-client';
import { tenantAuthCallbackUrl, tenantUrl, BASE_DOMAIN } from '@/lib/constants/domain';
import { USER_ROLES } from '@/types/roles';
import type { Database } from '@/types/database.types';
import type { TenantPlan, TenantSetupStatus, TenantSetupStep } from '@/types/tenant.types';

/**
 * Tenant provisioning, decomposed into individually re-runnable steps.
 *
 * Why steps rather than one function: provisioning touches three external
 * systems and any of them can fail transiently. Recording progress per step,
 * and making each step idempotent, means a failure is resumed rather than
 * restarted — which matters because step 1 creates a real, billable project.
 */

export interface StepContext {
  /** Absent until `tenant_registered` has run. */
  tenantId?: string;
  subdomain: string;
  name: string;
  /** Absent until `project_created` has run. */
  projectRef?: string;
  region?: string;
  plan?: TenantPlan;
  adminEmail?: string;
  /** Carried between steps within one run so credentials are fetched once. */
  credentials?: { url: string; anonKey: string; serviceRoleKey: string };
}

export interface StepResult {
  ok: boolean;
  message: string;
  context: StepContext;
}

// ─── individual steps ────────────────────────────────────────────────────────

async function stepProjectCreated(context: StepContext): Promise<StepResult> {
  if (context.projectRef) {
    return { ok: true, message: `הפרויקט ${context.projectRef} כבר קיים`, context };
  }

  const organizationId = process.env.SUPABASE_ORG_ID;
  if (!organizationId) throw new Error('SUPABASE_ORG_ID is not set.');

  // Refuse to silently create a billable project. When the free slot is taken
  // the operator should decide — usually by creating the project by hand and
  // registering it.
  const cost = await getProjectCost(organizationId);
  if (cost > 0) {
    throw new Error(
      'יצירת פרויקט נוסף בארגון כרוכה בתשלום. צור את הפרויקט ידנית ב-Supabase ורשום אותו דרך "רישום ידני".'
    );
  }

  const project = await createProject({
    // Only the first label of the apex, so `example.com` gives "example-acme".
    // Sanitised because this becomes a Supabase project name, and a stray
    // character here is visible in their dashboard forever.
    name: `${BASE_DOMAIN.split('.')[0].replace(/[^a-z0-9-]/gi, '') || 'tenant'}-${context.subdomain}`,
    organizationId,
    region: context.region ?? process.env.SUPABASE_DEFAULT_REGION ?? 'eu-central-1',
    dbPass: generateSecurePassword(),
  });

  await waitForProjectReady(project.id);

  return {
    ok: true,
    message: `הפרויקט ${project.id} נוצר`,
    context: { ...context, projectRef: project.id },
  };
}

async function stepMigrationsApplied(context: StepContext): Promise<StepResult> {
  if (!context.projectRef) throw new Error('אין פרויקט Supabase. הרץ קודם את שלב היצירה.');

  const migrations = getMigrationFilenames();

  // Migrations are written idempotently, so replaying the whole directory onto
  // a project that is partway through is safe — and simpler than tracking
  // which ones landed before the failure.
  for (const filename of migrations) {
    await executeSql(context.projectRef, readMigrationFile(filename));
  }

  return { ok: true, message: `${migrations.length} מיגרציות הורצו`, context };
}

async function stepBucketsCreated(context: StepContext): Promise<StepResult> {
  if (!context.projectRef) throw new Error('אין פרויקט Supabase.');

  const existing = new Set(await listBuckets(context.projectRef));
  const missing = DEFAULT_STORAGE_BUCKETS.filter((bucket) => !existing.has(bucket.name));

  for (const bucket of missing) {
    await createBucket(context.projectRef, {
      name: bucket.name,
      isPublic: bucket.isPublic,
      maxSizeBytes: bucket.maxSizeBytes,
      allowedMimeTypes: bucket.allowedMimeTypes,
    });
  }

  return {
    ok: true,
    message: missing.length ? `${missing.length} מאגרי אחסון נוצרו` : 'כל המאגרים כבר קיימים',
    context,
  };
}

async function stepAuthConfigured(context: StepContext): Promise<StepResult> {
  if (!context.projectRef) throw new Error('אין פרויקט Supabase.');

  await configureAuth({
    projectRef: context.projectRef,
    siteUrl: tenantUrl(context.subdomain),
    redirectUrls: [
      tenantAuthCallbackUrl(context.subdomain),
      // Wildcard so future subdomains and preview hosts work without another
      // config write.
      `https://*.${BASE_DOMAIN}/auth/callback`,
    ],
  });

  return { ok: true, message: 'הגדרות ההתחברות עודכנו', context };
}

async function stepCredentialsSaved(context: StepContext): Promise<StepResult> {
  if (!context.projectRef) throw new Error('אין פרויקט Supabase.');

  const credentials = await getProjectCredentials(context.projectRef);

  // If the tenant row exists, re-seal the keys into it; otherwise carry them to
  // the registration step.
  if (context.tenantId) {
    await updateTenant(context.tenantId, {
      supabase_url: credentials.url,
      supabase_anon_key: credentials.anonKey,
      supabase_service_role_key: credentials.serviceRoleKey,
    });
  }

  return {
    ok: true,
    message: 'המפתחות נקראו ונשמרו מוצפנים',
    context: { ...context, credentials },
  };
}

async function stepTenantRegistered(context: StepContext): Promise<StepResult> {
  if (context.tenantId) {
    return { ok: true, message: 'הטננט כבר רשום במאגר', context };
  }
  if (!context.projectRef) throw new Error('אין פרויקט Supabase.');

  const credentials =
    context.credentials ?? (await getProjectCredentials(context.projectRef));

  const tenant = await createTenant({
    subdomain: context.subdomain,
    name: context.name,
    supabase_project_ref: context.projectRef,
    supabase_url: credentials.url,
    supabase_anon_key: credentials.anonKey,
    supabase_service_role_key: credentials.serviceRoleKey,
    plan_type: context.plan,
  });

  return {
    ok: true,
    message: 'הטננט נרשם במאגר',
    context: { ...context, tenantId: tenant.id, credentials },
  };
}

async function stepDomainAdded(context: StepContext): Promise<StepResult> {
  if (!isDnsAutomationConfigured()) {
    return {
      ok: true,
      message: 'אוטומציית DNS אינה מוגדרת — הוסף רשומת CNAME ידנית',
      context,
    };
  }

  await addSubdomainRecord(context.subdomain);
  return { ok: true, message: `${context.subdomain}.${BASE_DOMAIN} נוסף`, context };
}

async function stepAdminCreated(context: StepContext): Promise<StepResult> {
  if (!context.adminEmail) {
    return { ok: true, message: 'לא הוגדר מנהל ראשון — דלג', context };
  }
  if (!context.tenantId) throw new Error('הטננט אינו רשום עדיין.');

  const tenant = await getTenantById(context.tenantId);
  if (!tenant) throw new Error('הטננט לא נמצא במאגר.');
  if (!tenant.supabase_service_role_key) {
    throw new Error('אין מפתח service role לטננט. הרץ מחדש את שלב שמירת המפתחות.');
  }

  const service = createSupabaseClient<Database>(
    tenant.supabase_url,
    tenant.supabase_service_role_key,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const email = context.adminEmail.trim().toLowerCase();

  const { data: existing } = await service
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    return { ok: true, message: `${email} כבר קיים כמנהל`, context };
  }

  const { data: created, error: authError } = await service.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (authError || !created.user) {
    throw new Error(`יצירת המנהל נכשלה: ${authError?.message ?? 'unknown'}`);
  }

  const { error: profileError } = await service.from('users').insert({
    id: created.user.id,
    email,
    app_role: USER_ROLES.ADMIN,
    is_active: true,
    invited_at: new Date().toISOString(),
  });

  if (profileError) {
    // Same rollback rule as the invite flow: never leave an auth user without a
    // profile, or the address is permanently unusable.
    await service.auth.admin.deleteUser(created.user.id);
    throw new Error(`יצירת פרופיל המנהל נכשלה: ${profileError.message}`);
  }

  return { ok: true, message: `${email} נוצר כמנהל המערכת`, context };
}

// ─── dispatch ────────────────────────────────────────────────────────────────

const STEP_RUNNERS: Record<TenantSetupStep, (context: StepContext) => Promise<StepResult>> = {
  project_created: stepProjectCreated,
  migrations_applied: stepMigrationsApplied,
  buckets_created: stepBucketsCreated,
  auth_configured: stepAuthConfigured,
  credentials_saved: stepCredentialsSaved,
  tenant_registered: stepTenantRegistered,
  domain_added: stepDomainAdded,
  admin_created: stepAdminCreated,
};

export async function runStep(
  step: TenantSetupStep,
  context: StepContext
): Promise<StepResult> {
  const runner = STEP_RUNNERS[step];
  if (!runner) throw new Error(`Unknown setup step: ${step}`);
  return runner(context);
}

/**
 * Records the outcome of one step on the tenant row.
 *
 * Merged rather than replaced so a re-run of step 3 does not erase what steps
 * 1 and 2 recorded.
 */
export async function recordStep(
  tenantId: string,
  step: TenantSetupStep,
  ok: boolean,
  error?: string
): Promise<void> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) return;

  const current: TenantSetupStatus = tenant.setup_status ?? { steps: {} };

  await updateTenant(tenantId, {
    setup_status: {
      ...current,
      steps: { ...current.steps, [step]: ok },
      last_error: ok ? undefined : error,
      updated_at: new Date().toISOString(),
    },
  });
}
