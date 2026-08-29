/**
 * Thin client over the Supabase Management API.
 *
 * Used only by tenant provisioning. Every call needs SUPABASE_MANAGEMENT_TOKEN,
 * a personal access token that can create and destroy projects — it must never
 * reach the browser.
 */

import { applyAuthMethodConfig } from '@/lib/auth/server/registry';

const API = 'https://api.supabase.com/v1';

function requireToken(): string {
  const token = process.env.SUPABASE_MANAGEMENT_TOKEN;
  if (!token) {
    throw new Error(
      'SUPABASE_MANAGEMENT_TOKEN is not set. Automated provisioning is unavailable; register the project manually instead.'
    );
  }
  return token;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireToken()}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase Management API ${response.status}: ${await response.text()}`);
  }

  // DELETE and some config endpoints answer 204.
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ─── projects ────────────────────────────────────────────────────────────────

export interface SupabaseProject {
  id: string;
  name: string;
  region: string;
  status: string;
}

/**
 * What a new project would cost.
 *
 * Non-zero means the org's free slot is taken. The provisioning flow refuses to
 * proceed in that case rather than silently adding a paid project — the
 * operator picks up the manual path instead.
 */
export async function getProjectCost(organizationId: string): Promise<number> {
  const cost = await call<{ amount?: number }>(
    `/organizations/${organizationId}/billing/subscription?type=project`
  ).catch(() => ({ amount: 0 }));

  return Number(cost?.amount ?? 0);
}

export async function createProject(input: {
  name: string;
  organizationId: string;
  region: string;
  dbPass: string;
}): Promise<SupabaseProject> {
  return call<SupabaseProject>('/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      organization_id: input.organizationId,
      region: input.region,
      db_pass: input.dbPass,
      plan: 'free',
    }),
  });
}

export async function getProjectStatus(projectRef: string): Promise<string> {
  const project = await call<{ status: string }>(`/projects/${projectRef}`);
  return project.status;
}

/**
 * Blocks until the project is healthy enough to accept SQL.
 *
 * Provisioning takes a couple of minutes and the API offers no webhook, so this
 * polls with backoff. The cap keeps a stuck project from hanging the request
 * forever — the setup wizard can re-run this step.
 */
export async function waitForProjectReady(
  projectRef: string,
  timeoutMs = 5 * 60 * 1000
): Promise<void> {
  const startedAt = Date.now();
  let delay = 3000;

  while (Date.now() - startedAt < timeoutMs) {
    const status = await getProjectStatus(projectRef).catch(() => 'UNKNOWN');
    if (status === 'ACTIVE_HEALTHY') return;

    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, 15000);
  }

  throw new Error(
    `Project ${projectRef} was not healthy within ${Math.round(timeoutMs / 1000)}s. Re-run the step once Supabase finishes provisioning.`
  );
}

export interface ProjectCredentials {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

export async function getProjectCredentials(projectRef: string): Promise<ProjectCredentials> {
  const keys = await call<
    Array<{ name: string; api_key: string; type?: string; id?: string }>
  >(`/projects/${projectRef}/api-keys`);

  // Supabase is migrating from legacy JWT keys (anon / service_role) to
  // publishable / secret keys. Prefer the new shape, fall back to the old.
  const publishable = keys.find((key) => key.type === 'publishable' || key.name === 'anon');
  const secret = keys.find((key) => key.type === 'secret' || key.name === 'service_role');

  if (!publishable) throw new Error(`No publishable/anon key on project ${projectRef}`);

  return {
    url: `https://${projectRef}.supabase.co`,
    anonKey: publishable.api_key,
    serviceRoleKey: secret?.api_key ?? '',
  };
}

// ─── SQL ─────────────────────────────────────────────────────────────────────

/**
 * Runs SQL on a project.
 *
 * Straight to the Management API — no `exec_sql` RPC probe first. That RPC does
 * not exist on a fresh project, so probing for it only ever costs a round trip.
 */
export async function executeSql(projectRef: string, sql: string): Promise<unknown> {
  return call<unknown>(`/projects/${projectRef}/database/query`, {
    method: 'POST',
    body: JSON.stringify({ query: sql }),
  });
}

// ─── storage ─────────────────────────────────────────────────────────────────

/**
 * Storage is split across two APIs, and the split is not obvious.
 *
 * The Management API can LIST a project's buckets — `GET /projects/{ref}/
 * storage/buckets` — but it cannot create one. There is no POST on that path,
 * and attempting it returns a router-level 404: `Cannot POST /v1/projects/…`.
 *
 * Creating a bucket is the project's OWN Storage API, authenticated with that
 * project's service-role key rather than the management token. Hence the two
 * functions below talking to two different hosts.
 */

export async function listBuckets(projectRef: string): Promise<string[]> {
  const buckets = await call<Array<{ name: string }>>(`/projects/${projectRef}/storage/buckets`);
  return buckets.map((bucket) => bucket.name);
}

export async function createBucket(
  projectRef: string,
  bucket: {
    name: string;
    isPublic: boolean;
    maxSizeBytes: number;
    allowedMimeTypes?: string[] | null;
  }
): Promise<void> {
  // Fetched per bucket rather than threaded through the caller: this runs three
  // times during a one-off provisioning step, and keeping the credential lookup
  // next to the call that needs it is worth more than the saved round trips.
  const credentials = await getProjectCredentials(projectRef);

  if (!credentials.serviceRoleKey) {
    throw new Error(
      `No service-role key on project ${projectRef}. Storage buckets cannot be created without it.`
    );
  }

  const response = await fetch(`${credentials.url}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials.serviceRoleKey}`,
      apikey: credentials.anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: bucket.name,
      name: bucket.name,
      public: bucket.isPublic,
      file_size_limit: bucket.maxSizeBytes,
      allowed_mime_types: bucket.allowedMimeTypes ?? undefined,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    // The caller diffs against listBuckets first, but a bucket created between
    // that read and this write is a success, not a failure to report.
    if (body.includes('already exists') || response.status === 409) return;
    throw new Error(`Failed to create bucket "${bucket.name}" (${response.status}): ${body}`);
  }
}

// ─── auth ────────────────────────────────────────────────────────────────────

export async function getAuthConfig(projectRef: string): Promise<Record<string, unknown>> {
  return call<Record<string, unknown>>(`/projects/${projectRef}/config/auth`);
}

/**
 * Points the project's auth at the tenant's own subdomain and configures the
 * providers this deployment actually signs people in with.
 *
 * The provider list is not hard-coded here: every method enabled in
 * `NEXT_PUBLIC_AUTH_METHODS` contributes its own fields through
 * `applyAuthMethodConfig`. So a phone-OTP deployment provisions tenants with an
 * SMS provider and no Google, without this file knowing either exists.
 *
 * The wildcard entry in the allow list is what lets preview deployments and
 * future subdomains complete an OAuth round trip without another config write.
 */
export async function configureAuth(input: {
  projectRef: string;
  siteUrl: string;
  redirectUrls: string[];
}): Promise<void> {
  const body = applyAuthMethodConfig({
    site_url: input.siteUrl,
    uri_allow_list: input.redirectUrls.join(','),
  });

  await call(`/projects/${input.projectRef}/config/auth`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** A database password strong enough that nobody is tempted to reuse one. */
export function generateSecurePassword(length = 32): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}
