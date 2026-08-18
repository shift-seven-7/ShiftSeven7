/**
 * AES-256-GCM envelope encryption for the tenant Supabase credentials stored in
 * the master registry.
 *
 * WHAT THIS PROTECTS: a dump, backup, or read-replica of the master database.
 * WHAT IT DOES NOT PROTECT: the anon key still reaches the browser by design
 * (the proxy injects it so the client SDK can talk to the tenant project).
 * The service-role key never leaves the server.
 *
 * SERVER ONLY. Never import this from a 'use client' module — eslint.config.mjs
 * blocks it under components/ and hooks/.
 *
 * WebCrypto (crypto.subtle), not node:crypto, because proxy.ts decrypts the
 * anon key on every request and may run on the Edge runtime.
 *
 * Envelope format (self-describing, so a plaintext value is distinguishable and
 * a key rotation can be resumed):
 *
 *     v1.<keyVersion>.<base64url iv>.<base64url ciphertext||tag>
 */

const FORMAT = 'v1';
const IV_BYTES = 12;
const ENVELOPE_RE = /^v1\.(\d+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/;

/** The key version new ciphertexts are written with. */
export const CURRENT_KEY_VERSION = 1;

// ─── key material ────────────────────────────────────────────────────────────

const keyCache = new Map<number, Promise<CryptoKey>>();

function readKeyMaterial(version: number): string {
  const current = process.env.TENANT_SECRETS_KEY;
  const previous = process.env.TENANT_SECRETS_KEY_PREVIOUS;

  if (version === CURRENT_KEY_VERSION) {
    if (!current) {
      throw new Error(
        'TENANT_SECRETS_KEY is not set. Generate one with `npm run secrets:generate-key`.'
      );
    }
    return current;
  }

  if (!previous) {
    throw new Error(
      `A tenant secret is sealed with key version ${version}, but only version ${CURRENT_KEY_VERSION} is available. ` +
        'Set TENANT_SECRETS_KEY_PREVIOUS to the old key and run `npm run secrets:rotate`.'
    );
  }
  return previous;
}

function importKey(version: number): Promise<CryptoKey> {
  const cached = keyCache.get(version);
  if (cached) return cached;

  const promise = (async () => {
    const raw = base64ToBytes(readKeyMaterial(version));
    if (raw.byteLength !== 32) {
      throw new Error(
        `TENANT_SECRETS_KEY must decode to exactly 32 bytes (got ${raw.byteLength}). ` +
          'Generate a valid key with `npm run secrets:generate-key`.'
      );
    }
    return crypto.subtle.importKey('raw', toArrayBuffer(raw), { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ]);
  })();

  keyCache.set(version, promise);
  return promise;
}

/** True when a usable encryption key is configured. */
export function hasSecretsKey(): boolean {
  return !!process.env.TENANT_SECRETS_KEY;
}

/**
 * Whether the configured key is actually usable, without decrypting anything.
 *
 * A key that is missing, malformed or the wrong length fails on the first
 * request that touches the registry — which, since the proxy decrypts an anon
 * key on every request, means the whole deployment. The health probe calls this
 * so the failure shows up at deploy time instead.
 */
export async function checkSecretsKey(): Promise<{ ok: boolean; reason?: string }> {
  if (!process.env.TENANT_SECRETS_KEY) {
    return { ok: false, reason: 'not_set' };
  }

  try {
    await importKey(CURRENT_KEY_VERSION);
    return { ok: true };
  } catch {
    // The message names byte lengths; the probe is public, so it only reports
    // that the key is unusable.
    return { ok: false, reason: 'invalid' };
  }
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Seals a secret.
 *
 * `aad` binds the ciphertext to where it lives — use
 * `secretAad(subdomain, column)`. A value copied into another tenant's row, or
 * into the other key column, then fails to decrypt instead of silently working.
 */
export async function encryptSecret(plain: string, aad: string): Promise<string> {
  const key = await importKey(CURRENT_KEY_VERSION);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encodeUtf8(aad) },
    key,
    encodeUtf8(plain)
  );

  return [
    FORMAT,
    CURRENT_KEY_VERSION,
    bytesToBase64Url(iv),
    bytesToBase64Url(new Uint8Array(sealed)),
  ].join('.');
}

/** Opens a sealed secret. Throws if `payload` is not a valid envelope. */
export async function decryptSecret(payload: string, aad: string): Promise<string> {
  const match = ENVELOPE_RE.exec(payload);
  if (!match) {
    throw new Error('Value is not an encrypted secret envelope.');
  }

  const [, versionRaw, ivRaw, cipherRaw] = match;
  const key = await importKey(Number(versionRaw));

  try {
    const opened = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(base64UrlToBytes(ivRaw)),
        additionalData: encodeUtf8(aad),
      },
      key,
      toArrayBuffer(base64UrlToBytes(cipherRaw))
    );
    return new TextDecoder().decode(opened);
  } catch {
    // GCM gives no detail on failure — wrong key, tampering, or wrong AAD all
    // land here. Name the likely causes rather than surfacing "OperationError".
    throw new Error(
      'Failed to decrypt a tenant secret. The key may be wrong, the row may have been ' +
        'moved between tenants, or the ciphertext may be corrupt.'
    );
  }
}

/**
 * Read path used everywhere: opens an envelope, passes anything else through
 * untouched.
 *
 * This is what lets a registry migrate from plaintext to encrypted while the
 * app keeps serving — see scripts/encrypt-tenant-secrets.ts.
 */
export async function decryptMaybe(value: string, aad: string): Promise<string> {
  if (!value) return value;
  if (!isEncrypted(value)) return value;
  return decryptSecret(value, aad);
}

export function isEncrypted(value: string): boolean {
  return ENVELOPE_RE.test(value);
}

/** The key version a stored value is sealed with, or null if it is plaintext. */
export function keyVersionOf(value: string): number | null {
  const match = ENVELOPE_RE.exec(value);
  return match ? Number(match[1]) : null;
}

/**
 * Which column a secret belongs to. Part of the AAD, so these strings are
 * effectively part of the stored format — do not rename them.
 */
export type SecretColumn = 'anon' | 'service';

export function secretAad(subdomain: string, column: SecretColumn): string {
  return `${subdomain}:${column}`;
}

/**
 * AAD for a value in the general `tenants.secrets` bag.
 *
 * The `secret:` segment is what keeps the two namespaces apart: without it a
 * bag entry named "anon" would share an AAD with the anon key column, and a
 * ciphertext could be moved between them undetected. Like the column names
 * above, this string is part of the stored format — renaming it makes every
 * stored secret unreadable.
 */
export function tenantSecretAad(subdomain: string, key: string): string {
  return `${subdomain}:secret:${key}`;
}

/**
 * Display form for a secret: enough to tell two keys apart in the admin UI,
 * not enough to use one. Safe to send to a browser.
 */
export function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 12) return '••••••••';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

// ─── encoding helpers ────────────────────────────────────────────────────────

function encodeUtf8(text: string): ArrayBuffer {
  return toArrayBuffer(new TextEncoder().encode(text));
}

/**
 * Uint8Array from TextEncoder/base64 decoding can be backed by a larger pooled
 * buffer; hand crypto.subtle an exactly-sized ArrayBuffer.
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  return base64ToBytes(padded);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
