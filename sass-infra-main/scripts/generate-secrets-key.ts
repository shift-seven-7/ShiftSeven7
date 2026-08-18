/**
 * Generates a TENANT_SECRETS_KEY.
 *
 *   npm run secrets:generate-key
 *
 * Emits 32 random bytes as base64 — the AES-256 key that wraps every tenant's
 * Supabase credentials in the master registry.
 *
 * Store it in .env.local (and in the Vercel project's environment). Losing it
 * makes every stored credential unreadable; there is no recovery path short of
 * re-fetching the keys from each Supabase project by hand.
 */

import { webcrypto } from 'node:crypto';

const key = webcrypto.getRandomValues(new Uint8Array(32));
const base64 = Buffer.from(key).toString('base64');

console.log('');
console.log('Add this to .env.local (and to your Vercel environment):');
console.log('');
console.log(`TENANT_SECRETS_KEY=${base64}`);
console.log('');
console.log('Rotating an existing key? Move the old value to');
console.log('TENANT_SECRETS_KEY_PREVIOUS, set the new one above, then run');
console.log('`npm run secrets:rotate`.');
console.log('');
