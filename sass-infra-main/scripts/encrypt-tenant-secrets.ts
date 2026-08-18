/**
 * Encrypts tenant Supabase keys that are still stored as plaintext.
 *
 *   npm run secrets:encrypt -- --dry-run
 *   npm run secrets:encrypt
 *   npm run secrets:encrypt -- --tenant=acme
 *
 * Only needed when adopting an existing registry: anything written through
 * lib/supabase/master-client.ts is already sealed.
 *
 * Safe to run while the app is serving. `decryptMaybe` passes plaintext through
 * untouched, so rows that have not been converted yet keep working — there is
 * no window where the app cannot read a tenant.
 *
 * Requires MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_KEY, TENANT_SECRETS_KEY.
 */

import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import {
  CURRENT_KEY_VERSION,
  decryptSecret,
  encryptSecret,
  isEncrypted,
  secretAad,
} from '../lib/crypto/secrets';

loadEnvConfig(process.cwd());

interface Row {
  id: string;
  subdomain: string;
  supabase_anon_key: string;
  supabase_service_role_key: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to .env.local.`);
  return value;
}

function getClient() {
  return createClient(
    requireEnv('MASTER_SUPABASE_URL'),
    requireEnv('MASTER_SUPABASE_SERVICE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function main() {
  requireEnv('TENANT_SECRETS_KEY');

  const dryRun = process.argv.includes('--dry-run');
  const tenantArg = process.argv.find((arg) => arg.startsWith('--tenant='));
  const only = tenantArg?.split('=')[1];

  if (dryRun) console.log('=== DRY RUN — nothing will be written ===\n');

  const client = getClient();
  const base = client
    .from('tenants')
    .select('id, subdomain, supabase_anon_key, supabase_service_role_key');

  const { data, error } = only ? await base.eq('subdomain', only) : await base;
  if (error) throw new Error(`Failed to read tenants: ${error.message}`);

  const rows = (data ?? []) as Row[];
  console.log(`${rows.length} tenant(s) in the registry\n`);

  let converted = 0;
  let skipped = 0;

  for (const row of rows) {
    const anonSealed = isEncrypted(row.supabase_anon_key);
    const serviceSealed =
      !row.supabase_service_role_key || isEncrypted(row.supabase_service_role_key);

    if (anonSealed && serviceSealed) {
      console.log(`  ${row.subdomain}: already encrypted`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(
        `  ${row.subdomain}: would encrypt ${[
          !anonSealed && 'anon',
          !serviceSealed && 'service_role',
        ]
          .filter(Boolean)
          .join(' + ')}`
      );
      converted++;
      continue;
    }

    const patch: Record<string, unknown> = { secrets_key_version: CURRENT_KEY_VERSION };

    if (!anonSealed) {
      patch.supabase_anon_key = await encryptSecret(
        row.supabase_anon_key,
        secretAad(row.subdomain, 'anon')
      );
    }
    if (!serviceSealed) {
      patch.supabase_service_role_key = await encryptSecret(
        row.supabase_service_role_key,
        secretAad(row.subdomain, 'service')
      );
    }

    const { error: updateError } = await client.from('tenants').update(patch).eq('id', row.id);
    if (updateError) {
      console.error(`  ${row.subdomain}: FAILED — ${updateError.message}`);
      process.exitCode = 1;
      continue;
    }

    // Read back and open it. An unverified write here would mean discovering
    // an unreadable credential the next time a user hits that tenant.
    const { data: check } = await client
      .from('tenants')
      .select('supabase_anon_key, supabase_service_role_key')
      .eq('id', row.id)
      .single();

    const verified = check as Pick<Row, 'supabase_anon_key' | 'supabase_service_role_key'>;

    await decryptSecret(verified.supabase_anon_key, secretAad(row.subdomain, 'anon'));
    if (verified.supabase_service_role_key) {
      await decryptSecret(
        verified.supabase_service_role_key,
        secretAad(row.subdomain, 'service')
      );
    }

    console.log(`  ${row.subdomain}: encrypted and verified`);
    converted++;
  }

  console.log(`\n────────────────────────────`);
  console.log(`converted: ${converted}   already sealed: ${skipped}`);
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
