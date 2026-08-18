/**
 * Rotates TENANT_SECRETS_KEY.
 *
 *   1. Generate a new key:  npm run secrets:generate-key
 *   2. In .env.local, move the CURRENT key to TENANT_SECRETS_KEY_PREVIOUS
 *      and put the new one in TENANT_SECRETS_KEY.
 *   3. npm run secrets:rotate -- --dry-run
 *   4. npm run secrets:rotate
 *   5. Remove TENANT_SECRETS_KEY_PREVIOUS.
 *
 * Between steps 2 and 5 the app keeps working: the envelope carries its key
 * version, so a row sealed with either key opens.
 *
 * Idempotent and resumable — rows already at the new version are skipped, so an
 * interrupted run is finished by running it again.
 */

import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import {
  CURRENT_KEY_VERSION,
  decryptSecret,
  encryptSecret,
  isEncrypted,
  keyVersionOf,
  secretAad,
  tenantSecretAad,
} from '../lib/crypto/secrets';

loadEnvConfig(process.cwd());

interface Row {
  id: string;
  subdomain: string;
  supabase_anon_key: string;
  supabase_service_role_key: string;
  secrets: Record<string, string> | null;
  secrets_key_version: number;
}

/**
 * Re-seals every entry in the general secrets bag. Same key, same rotation —
 * missing this column would leave those values readable only by the retired
 * key, which is exactly the failure the rotation is meant to avoid.
 */
async function rotateSecretsBag(
  subdomain: string,
  bag: Record<string, string> | null
): Promise<Record<string, string>> {
  const rotated: Record<string, string> = {};

  for (const [key, sealed] of Object.entries(bag ?? {})) {
    const aad = tenantSecretAad(subdomain, key);
    // Plaintext leftovers pass through untouched — the encrypt script's job.
    rotated[key] = isEncrypted(sealed)
      ? await encryptSecret(await decryptSecret(sealed, aad), aad)
      : sealed;
  }

  return rotated;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to .env.local.`);
  return value;
}

async function main() {
  requireEnv('TENANT_SECRETS_KEY');

  if (!process.env.TENANT_SECRETS_KEY_PREVIOUS) {
    throw new Error(
      'TENANT_SECRETS_KEY_PREVIOUS is not set. Rotation needs the old key to open the existing envelopes.'
    );
  }

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('=== DRY RUN — nothing will be written ===\n');

  const client = createClient(
    requireEnv('MASTER_SUPABASE_URL'),
    requireEnv('MASTER_SUPABASE_SERVICE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await client
    .from('tenants')
    .select(
      'id, subdomain, supabase_anon_key, supabase_service_role_key, secrets, secrets_key_version'
    );

  if (error) throw new Error(`Failed to read tenants: ${error.message}`);

  const rows = (data ?? []) as Row[];
  console.log(`${rows.length} tenant(s) in the registry\n`);

  let rotated = 0;
  let skipped = 0;

  for (const row of rows) {
    const anonVersion = keyVersionOf(row.supabase_anon_key);

    // Plaintext rows are the encrypt script's job, not this one's.
    if (!isEncrypted(row.supabase_anon_key)) {
      console.log(`  ${row.subdomain}: plaintext — run \`npm run secrets:encrypt\` first`);
      skipped++;
      continue;
    }

    if (anonVersion === CURRENT_KEY_VERSION && row.secrets_key_version === CURRENT_KEY_VERSION) {
      console.log(`  ${row.subdomain}: already on key v${CURRENT_KEY_VERSION}`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  ${row.subdomain}: would rotate v${anonVersion} -> v${CURRENT_KEY_VERSION}`);
      rotated++;
      continue;
    }

    try {
      // decryptSecret picks the key by the version inside the envelope, so this
      // opens with the old key and re-seals with the new one.
      const anonAad = secretAad(row.subdomain, 'anon');
      const serviceAad = secretAad(row.subdomain, 'service');

      const anonPlain = await decryptSecret(row.supabase_anon_key, anonAad);
      const servicePlain = row.supabase_service_role_key
        ? await decryptSecret(row.supabase_service_role_key, serviceAad)
        : '';

      const { error: updateError } = await client
        .from('tenants')
        .update({
          supabase_anon_key: await encryptSecret(anonPlain, anonAad),
          supabase_service_role_key: servicePlain
            ? await encryptSecret(servicePlain, serviceAad)
            : '',
          secrets: await rotateSecretsBag(row.subdomain, row.secrets),
          secrets_key_version: CURRENT_KEY_VERSION,
        })
        .eq('id', row.id);

      if (updateError) throw new Error(updateError.message);

      // Verify the re-sealed value opens before moving on.
      const { data: check } = await client
        .from('tenants')
        .select('supabase_anon_key')
        .eq('id', row.id)
        .single();

      await decryptSecret((check as { supabase_anon_key: string }).supabase_anon_key, anonAad);

      console.log(`  ${row.subdomain}: rotated and verified`);
      rotated++;
    } catch (err) {
      console.error(
        `  ${row.subdomain}: FAILED — ${err instanceof Error ? err.message : String(err)}`
      );
      process.exitCode = 1;
    }
  }

  console.log(`\n────────────────────────────`);
  console.log(`rotated: ${rotated}   skipped: ${skipped}`);

  if (rotated > 0 && !dryRun) {
    console.log('\nRotation complete. Remove TENANT_SECRETS_KEY_PREVIOUS from the environment.');
  }
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
