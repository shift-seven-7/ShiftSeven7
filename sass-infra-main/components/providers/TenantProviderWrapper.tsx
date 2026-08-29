import { Suspense } from 'react';
import { headers } from 'next/headers';
import { TenantProvider, type TenantCredentials } from './TenantProvider';

/**
 * Server-side half of the tenant context: reads the four headers proxy.ts
 * injected and hands them to the client provider.
 *
 * Suspense-wrapped because `headers()` opts the subtree into dynamic
 * rendering — without it, the whole app would fail to build statically.
 */

async function TenantProviderInner({ children }: { children: React.ReactNode }) {
  const headersList = await headers();

  const tenantId = headersList.get('x-tenant-id');
  const subdomain = headersList.get('x-tenant-subdomain');
  const supabaseUrl = headersList.get('x-supabase-url');
  const supabaseAnonKey = headersList.get('x-supabase-anon-key');

  const credentials: TenantCredentials | undefined =
    tenantId && subdomain && supabaseUrl && supabaseAnonKey
      ? { tenantId, subdomain, supabaseUrl, supabaseAnonKey }
      : undefined;

  return <TenantProvider credentials={credentials}>{children}</TenantProvider>;
}

function TenantLoadingFallback() {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-background">
      <div className="text-muted-foreground">טוען...</div>
    </div>
  );
}

export function TenantProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<TenantLoadingFallback />}>
      <TenantProviderInner>{children}</TenantProviderInner>
    </Suspense>
  );
}
