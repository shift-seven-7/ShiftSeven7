import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useImpersonation } from "@/lib/ImpersonationContext";
import { ROUTE_ACCESS } from "@/lib/routePermissions";

export default function RequireAccess() {
  const { effectiveAccessLevel } = useImpersonation();
  const { pathname } = useLocation();

  if (effectiveAccessLevel === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  const allowed = ROUTE_ACCESS[pathname];
  // Unknown paths (typos, stale bookmarks) aren't gated here — they fall through
  // to the router's own "*" -> PageNotFound match.
  if (!allowed || allowed.includes(effectiveAccessLevel)) {
    return <Outlet />;
  }

  return <Navigate to="/" replace />;
}
