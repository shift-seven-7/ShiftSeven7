import { BASE_DOMAIN } from '@/lib/constants/domain';

/**
 * Vercel DNS, for pointing a tenant's subdomain at the deployment.
 *
 * This assumes a wildcard domain (`*.<BASE_DOMAIN>`) is already attached to the
 * Vercel project, so onboarding a tenant only needs a DNS record — not a new
 * project domain.
 *
 * Every value comes from env. Nothing here is specific to any one deployment.
 */

const API = 'https://api.vercel.com';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. DNS automation is unavailable.`);
  }
  return value;
}

function teamQuery(): string {
  const teamId = process.env.VERCEL_TEAM_ID;
  return teamId ? `?teamId=${teamId}` : '';
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireEnv('VERCEL_TOKEN')}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Vercel API ${response.status}: ${await response.text()}`);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

interface DnsRecord {
  id: string;
  name: string;
  type: string;
}

export async function listDnsRecords(): Promise<DnsRecord[]> {
  const result = await call<{ records: DnsRecord[] }>(
    `/v4/domains/${BASE_DOMAIN}/records${teamQuery()}`
  );
  return result.records ?? [];
}

export async function hasSubdomainRecord(subdomain: string): Promise<boolean> {
  const records = await listDnsRecords();
  return records.some((record) => record.name === subdomain);
}

/**
 * Adds the CNAME that makes `<subdomain>.<BASE_DOMAIN>` resolve.
 *
 * Idempotent: an existing record for the subdomain is left alone rather than
 * duplicated, so the setup step can be re-run safely.
 */
export async function addSubdomainRecord(subdomain: string): Promise<void> {
  if (await hasSubdomainRecord(subdomain)) return;

  await call(`/v2/domains/${BASE_DOMAIN}/records${teamQuery()}`, {
    method: 'POST',
    body: JSON.stringify({
      name: subdomain,
      type: 'CNAME',
      value: requireEnv('VERCEL_DNS_TARGET'),
      ttl: 60,
    }),
  });
}

export async function removeSubdomainRecord(subdomain: string): Promise<void> {
  const records = await listDnsRecords();
  const record = records.find((entry) => entry.name === subdomain);
  if (!record) return;

  await call(`/v2/domains/${BASE_DOMAIN}/records/${record.id}${teamQuery()}`, {
    method: 'DELETE',
  });
}

/** True when DNS automation is configured; the setup step skips itself otherwise. */
export function isDnsAutomationConfigured(): boolean {
  return !!(process.env.VERCEL_TOKEN && process.env.VERCEL_DNS_TARGET);
}
