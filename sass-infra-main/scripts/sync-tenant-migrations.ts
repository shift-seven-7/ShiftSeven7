/**
 * Applies supabase/migrations/ to every active tenant's own Supabase project.
 *
 *   npm run sync-tenant-migrations                        # all active tenants
 *   npm run sync-tenant-migrations -- --tenant=acme       # one tenant
 *   npm run sync-tenant-migrations -- --dry-run           # preview only
 *
 * Each tenant database keeps its own `_applied_migrations` table, so tenants
 * onboarded at different times converge to the same schema without anyone
 * tracking who is where.
 *
 * WORKFLOW: apply to one tenant first, verify, then run for all. And write
 * migrations idempotently — see the `migrations` skill.
 *
 * Requires MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_KEY and
 * SUPABASE_MANAGEMENT_TOKEN.
 */

import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { getMigrationFilenames, readMigrationFile } from '../lib/constants/migrations';

loadEnvConfig(process.cwd());

const MANAGEMENT_API = 'https://api.supabase.com/v1';
const TRACKING_TABLE = '_applied_migrations';

const TRACKING_DDL = `
  CREATE TABLE IF NOT EXISTS public.${TRACKING_TABLE} (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

interface TenantTarget {
  id: string;
  subdomain: string;
  supabase_project_ref: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to .env.local.`);
  return value;
}

function getMasterClient() {
  return createClient(
    requireEnv('MASTER_SUPABASE_URL'),
    requireEnv('MASTER_SUPABASE_SERVICE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function listTargets(only?: string): Promise<TenantTarget[]> {
  const query = getMasterClient()
    .from('tenants')
    .select('id, subdomain, supabase_project_ref')
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  const { data, error } = only ? await query.eq('subdomain', only) : await query;
  if (error) throw new Error(`Failed to list tenants: ${error.message}`);

  // A hosted project ref is 20 lowercase letters. Anything else is a local or
  // placeholder tenant that the Management API cannot reach.
  return (data ?? []).filter((row): row is TenantTarget =>
    /^[a-z]{20}$/.test(row.supabase_project_ref ?? '')
  );
}

async function executeSql(projectRef: string, sql: string): Promise<unknown> {
  const response = await fetch(`${MANAGEMENT_API}/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireEnv('SUPABASE_MANAGEMENT_TOKEN')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function getApplied(projectRef: string): Promise<Set<string>> {
  await executeSql(projectRef, TRACKING_DDL);
  const rows = (await executeSql(
    projectRef,
    `SELECT filename FROM public.${TRACKING_TABLE};`
  )) as Array<{ filename: string }>;
  return new Set(rows.map((row) => row.filename));
}

async function syncTenant(
  tenant: TenantTarget,
  migrations: string[],
  dryRun: boolean
): Promise<{ applied: number; failed: number }> {
  console.log(`\n── ${tenant.subdomain} (${tenant.supabase_project_ref})`);

  const applied = dryRun ? new Set<string>() : await getApplied(tenant.supabase_project_ref);
  const pending = migrations.filter((file) => !applied.has(file));

  if (pending.length === 0) {
    console.log('   up to date');
    return { applied: 0, failed: 0 };
  }

  let count = 0;

  for (const file of pending) {
    if (dryRun) {
      console.log(`   would apply  ${file}`);
      count++;
      continue;
    }

    try {
      process.stdout.write(`   applying     ${file} ... `);
      await executeSql(tenant.supabase_project_ref, readMigrationFile(file));
      // Parameterised via a quoted literal — filenames come from readdir, but
      // there is no reason to concatenate untrusted-looking text into SQL.
      await executeSql(
        tenant.supabase_project_ref,
        `INSERT INTO public.${TRACKING_TABLE} (filename)
         VALUES (${quoteLiteral(file)})
         ON CONFLICT (filename) DO NOTHING;`
      );
      console.log('ok');
      count++;
    } catch (err) {
      console.log('FAILED');
      console.error(`     ${err instanceof Error ? err.message : String(err)}`);
      // Later migrations usually build on this one — stop this tenant here,
      // but keep going with the others so one bad tenant does not block a fleet.
      return { applied: count, failed: 1 };
    }
  }

  return { applied: count, failed: 0 };
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const tenantArg = process.argv.find((arg) => arg.startsWith('--tenant='));
  const only = tenantArg?.split('=')[1];

  if (dryRun) console.log('=== DRY RUN — nothing will be applied ===');

  const migrations = getMigrationFilenames();
  console.log(`${migrations.length} migration file(s) on disk`);

  const targets = await listTargets(only);
  if (targets.length === 0) {
    console.log(only ? `No active tenant "${only}" with a hosted project.` : 'No active tenants.');
    return;
  }

  console.log(`${targets.length} tenant(s) to sync`);

  let totalApplied = 0;
  let failedTenants = 0;

  for (const tenant of targets) {
    const result = await syncTenant(tenant, migrations, dryRun);
    totalApplied += result.applied;
    failedTenants += result.failed;
  }

  console.log(`\n────────────────────────────`);
  console.log(`applied: ${totalApplied}   tenants failed: ${failedTenants}`);

  if (failedTenants > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
