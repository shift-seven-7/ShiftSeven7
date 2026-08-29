"use client";

import Dashboard from "@/components/Dashboard";
import MyAreaPage from "@/app/(dashboard)/my-area/page";
import { useImpersonation } from "@/lib/impersonation-context";

export default function Home() {
  const { effectiveAccessLevel } = useImpersonation();

  if (effectiveAccessLevel === null) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (effectiveAccessLevel === "no_access") {
    return <div className="text-center py-16 text-sm text-muted-foreground">אין לך הרשאת גישה למערכת. פנה למנהל המערכת.</div>;
  }

  return ["admin", "scheduler"].includes(effectiveAccessLevel) ? <Dashboard /> : <MyAreaPage />;
}
