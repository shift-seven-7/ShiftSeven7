"use client";

import { useImpersonation } from "@/lib/impersonation-context";
import { ROUTE_ACCESS } from "@/lib/routePermissions";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function RequireAccess({ children }: { children: React.ReactNode }) {
  const { effectiveAccessLevel } = useImpersonation();
  const pathname = usePathname();
  const router = useRouter();

  const allowed = ROUTE_ACCESS[pathname];
  // Unknown paths (typos, stale bookmarks) aren't gated here - Next's own
  // not-found handling takes over.
  const isAllowed = !allowed || (effectiveAccessLevel && allowed.includes(effectiveAccessLevel));

  useEffect(() => {
    if (effectiveAccessLevel !== null && allowed && !isAllowed) {
      router.replace("/");
    }
  }, [effectiveAccessLevel, allowed, isAllowed, router]);

  if (effectiveAccessLevel === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!allowed || isAllowed) {
    return <>{children}</>;
  }

  return null;
}
