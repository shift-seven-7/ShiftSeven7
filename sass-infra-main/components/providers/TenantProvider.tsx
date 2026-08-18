'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

/**
 * Makes the resolved tenant available to the client.
 *
 * The credentials arrive from the server (TenantProviderWrapper reads the
 * headers the proxy injected) and are published on `window` *during render* —
 * not in an effect — because children may call `createClient()` while
 * hydrating, before any effect has run.
 *
 * The anon key here is not a secret: it is the same publishable key a
 * single-tenant Supabase app ships in its bundle. The service-role key never
 * reaches this layer.
 */

export interface TenantCredentials {
  tenantId: string;
  subdomain: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

interface TenantContextValue {
  credentials: TenantCredentials | null;
  isResolved: boolean;
}

const TenantContext = createContext<TenantContextValue>({
  credentials: null,
  isResolved: false,
});

interface TenantProviderProps {
  children: ReactNode;
  credentials?: TenantCredentials;
}

export function TenantProvider({ children, credentials }: TenantProviderProps) {
  if (typeof window !== 'undefined' && credentials) {
    window.__TENANT_CREDENTIALS__ = credentials;
  }

  const [value] = useState<TenantContextValue>({
    credentials: credentials ?? null,
    isResolved: !!credentials,
  });

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}

export function useTenantId(): string | null {
  return useTenant().credentials?.tenantId ?? null;
}

export function useSubdomain(): string | null {
  return useTenant().credentials?.subdomain ?? null;
}
