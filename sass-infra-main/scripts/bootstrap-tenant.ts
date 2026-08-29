/**
 * Provisions a tenant from the command line.
 *
 *   npm run tenant:bootstrap -- --subdomain=acme --name="Acme Corp" --admin=me@example.com
 *   npm run tenant:bootstrap -- --subdomain=acme --name="Acme" --existing-ref=abcdefghijklmnopqrst
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * The tenant console lives at /app/admin/tenants — inside a tenant. Reaching it
 * requires being an ADMIN on a tenant that already exists, so the FIRST tenant
 * of a deployment cannot be created through the UI. This script breaks that
 * cycle.
 *
 * It is also the recovery path when the console itself is unreachable.
 *
 * Runs the same eight steps as the UI (lib/services/tenant-automation.ts), so
 * there is no second implementation to keep in sync. A partial run is
 * resumable: fix the cause and re-run the failed step from
 * /app/admin/tenants/[id]/setup, or run this again.
 *
 * Needs MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_KEY, TENANT_SECRETS_KEY,
 * SUPABASE_MANAGEMENT_TOKEN and SUPABASE_ORG_ID.
 */

import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function requireEnv(name: string, hint: string): void {
  if (!process.env[name]) throw new Error(`${name} is not set.\n  ${hint}`);
}

async function main() {
  const subdomain = getArg('subdomain')?.trim().toLowerCase();
  const name = getArg('name')?.trim();
  const adminEmail = getArg('admin')?.trim().toLowerCase();
  const region = getArg('region');
  const existingProjectRef = getArg('existing-ref')?.trim();

  if (!subdomain || !name) {
    console.error(
      'Usage:\n' +
        '  npm run tenant:bootstrap -- --subdomain=acme --name="Acme Corp" [--admin=me@example.com]\n' +
        '                              [--region=eu-central-1] [--existing-ref=<project ref>]\n'
    );
    process.exit(1);
  }

  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(subdomain)) {
    throw new Error('Subdomain may contain only lowercase letters, digits and inner hyphens.');
  }

  requireEnv('MASTER_SUPABASE_URL', 'The hosted registry project this tenant is registered in.');
  requireEnv('MASTER_SUPABASE_SERVICE_KEY', 'Service-role key of the registry project.');
  requireEnv(
    'TENANT_SECRETS_KEY',
    'Run `npm run secrets:generate-key`. Without it the tenant credentials cannot be sealed.'
  );

  if (!existingProjectRef) {
    requireEnv(
      'SUPABASE_MANAGEMENT_TOKEN',
      'Needed to create the Supabase project. Or create it by hand and pass --existing-ref.'
    );
    requireEnv('SUPABASE_ORG_ID', 'The Supabase organization the new project belongs to.');
  }

  // Imported lazily so the env checks above produce the error, rather than a
  // module-load failure from deep inside the service layer.
  const { provisionTenant } = await import('../lib/services/tenant-automation');
  const { SETUP_STEP_LABELS } = await import('../types/tenant.types');

  console.log(`\nProvisioning "${name}" at ${subdomain}\n`);

  const result = await provisionTenant({
    subdomain,
    name,
    region,
    adminEmail,
    existingProjectRef,
  });

  for (const step of result.steps) {
    console.log(`  ${step.ok ? 'ok  ' : 'FAIL'}  ${SETUP_STEP_LABELS[step.step]}`);
    console.log(`        ${step.message}`);
  }

  if (result.completed) {
    console.log(`\nDone. Tenant id ${result.tenantId}`);
    if (adminEmail) {
      console.log(`${adminEmail} is an ADMIN — sign in with Google, or use "forgot password".`);
    } else {
      console.log('No admin was created. Re-run with --admin=<email>, or use the setup wizard.');
    }
    return;
  }

  console.error('\nProvisioning stopped. Nothing was rolled back.');

  if (result.tenantId) {
    console.error(
      `Re-run the failed step at /app/admin/tenants/${result.tenantId}/setup, ` +
        'or run this command again.'
    );
  } else if (result.projectRef) {
    // Steps 1-5 run before `tenant_registered` creates the registry row, so a
    // failure in that window leaves no tenant and therefore no setup wizard to
    // resume from. Re-running plainly would skip nothing and create a SECOND
    // billable Supabase project, which is the expensive way to find this out.
    console.error(
      `\nThe Supabase project (${result.projectRef}) was created, but the tenant is not\n` +
        'registered yet — there is no setup wizard to resume from.\n\n' +
        'Fix the cause, then re-run WITH the project ref so step 1 is skipped.\n' +
        'Without it you would create a second billable project:\n\n' +
        `  npm run tenant:bootstrap -- \\\n` +
        `    --subdomain=${subdomain} \\\n` +
        `    --name=${JSON.stringify(name)} \\\n` +
        `    --existing-ref=${result.projectRef}` +
        (adminEmail ? ` \\\n    --admin=${adminEmail}` : '') +
        (region ? ` \\\n    --region=${region}` : '') +
        '\n'
    );
  } else {
    console.error('Fix the cause and run this command again.');
  }

  process.exit(1);
}

main().catch((err) => {
  console.error('\nFatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
