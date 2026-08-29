/**
 * Seeds demo tenants into the LOCAL registry.
 *
 *   npm run db:seed
 *   npm run db:seed -- --reset     # delete the demo rows first
 *
 * Why this exists: `npm run dev` resolves tenants through the registry exactly
 * as production does — the env bypass is deliberately disabled when
 * USE_LOCAL_DB=true, so local behaviour matches production. Without a row in
 * `public.tenants` nothing resolves and every page rewrites to
 * /tenant-not-found.
 *
 * Run `npm run db:migrate:master` first; that is what creates the table.
 *
 * ── THE ONE THING THIS CANNOT SIMULATE ───────────────────────────────────────
 * There is a single local Supabase stack, so all three demo tenants point at
 * the SAME database and share users and data. Tenant resolution, the registry
 * lookup, credential encryption, the proxy cache and the admin console are all
 * exercised for real. Data isolation — the thing separate projects give you in
 * production — is not.
 */

import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { CURRENT_KEY_VERSION, encryptSecret, secretAad } from '../lib/crypto/secrets';

loadEnvConfig(process.cwd());

/** Subdomains this script owns. `--reset` only ever deletes these. */
const DEMO_TENANTS = [
  { subdomain: 'local', name: 'Local Dev', nameHe: 'סביבה מקומית' },
  { subdomain: 'acme', name: 'Acme Corp', nameHe: 'אקמי בע״מ' },
  { subdomain: 'beta', name: 'Beta Industries', nameHe: 'בטא תעשיות' },
];

function requireEnv(name: string, hint: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.\n  ${hint}`);
  return value;
}

async function main() {
  const reset = process.argv.includes('--reset');

  const url = requireEnv(
    'LOCAL_TENANT_SUPABASE_URL',
    'Run `npm run db:start`, then `supabase status -o env` and copy the API URL.'
  );
  const serviceKey = requireEnv(
    'LOCAL_TENANT_SUPABASE_SERVICE_KEY',
    'Run `supabase status -o env` and copy SERVICE_ROLE_KEY (it looks like sb_secret_… on current CLI versions).'
  );
  const anonKey = requireEnv(
    'LOCAL_TENANT_SUPABASE_ANON_KEY',
    'Run `supabase status -o env` and copy ANON_KEY (it looks like sb_publishable_… on current CLI versions).'
  );
  requireEnv(
    'TENANT_SECRETS_KEY',
    'Run `npm run secrets:generate-key` and put the value in .env.local. Without it every registry write fails.'
  );

  const client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Fail with something actionable rather than a raw PostgREST code.
  const { error: probeError } = await client.from('tenants').select('id').limit(1);
  if (probeError) {
    throw new Error(
      `Cannot read public.tenants (${probeError.message}).\n` +
        '  The registry table does not exist yet — run `npm run db:migrate:master`.'
    );
  }

  if (reset) {
    const subdomains = DEMO_TENANTS.map((tenant) => tenant.subdomain);
    await client.from('tenants').delete().in('subdomain', subdomains);
    console.log(`removed demo tenants: ${subdomains.join(', ')}\n`);
  }

  for (const tenant of DEMO_TENANTS) {
    // Encrypted through the real path, so local development exercises the same
    // envelope format production uses.
    const [sealedAnon, sealedService] = await Promise.all([
      encryptSecret(anonKey, secretAad(tenant.subdomain, 'anon')),
      encryptSecret(serviceKey, secretAad(tenant.subdomain, 'service')),
    ]);

    const row = {
      subdomain: tenant.subdomain,
      name: tenant.name,
      name_he: tenant.nameHe,
      status: 'active',
      supabase_project_ref: 'local',
      supabase_url: url,
      supabase_anon_key: sealedAnon,
      supabase_service_role_key: sealedService,
      secrets_key_version: CURRENT_KEY_VERSION,
      plan_type: 'standard',
      max_users: 25,
      storage_limit_gb: 10,
      settings: {},
      setup_status: null,
    };

    // Idempotent: re-running re-seals the keys, which is also how you recover
    // after regenerating TENANT_SECRETS_KEY.
    const { error } = await client.from('tenants').upsert(row, { onConflict: 'subdomain' });

    if (error) {
      console.error(`  ${tenant.subdomain}: FAILED — ${error.message}`);
      process.exitCode = 1;
      continue;
    }

    console.log(`  ${tenant.subdomain}: ready  →  http://${tenant.subdomain}.localhost:3000`);
  }

  console.log('\nDemo tenants share one local database — see the header of this file.');
}

main().catch((err) => {
  console.error('\nFatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
