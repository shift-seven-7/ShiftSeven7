import Layout from "@/components/Layout";
import RequireAccess from "@/components/RequireAccess";
import { ImpersonationProvider } from "@/lib/impersonation-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ImpersonationProvider>
      <Layout>
        <RequireAccess>{children}</RequireAccess>
      </Layout>
    </ImpersonationProvider>
  );
}
