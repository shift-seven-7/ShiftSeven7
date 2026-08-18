import { ProtectedAppLayoutClient } from './ProtectedAppLayoutClient';

/**
 * Everything under /app is authenticated. The guard itself is client-side —
 * proxy.ts has already refused anonymous requests before they get here.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedAppLayoutClient>{children}</ProtectedAppLayoutClient>;
}
