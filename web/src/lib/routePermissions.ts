// Single source of truth for which staff.access_level tiers may reach which
// route. Consumed by both the sidebar (layout) and the route guard so nav
// visibility and actual access can never drift apart.
//
// The real security boundary is Postgres RLS (see docs/MIGRATION_PLAN.md
// B.3) - this map is UX only (hide/redirect), ported as-is from the old
// app's src/lib/routePermissions.js.
export type AccessLevel = "admin" | "scheduler" | "employee" | "no_access";

export const ROUTE_ACCESS: Record<string, AccessLevel[]> = {
  "/": ["admin", "scheduler", "employee", "no_access"],
  "/staff": ["admin"],
  "/settings": ["admin"],
  "/posts": ["admin", "scheduler"],
  "/shifts": ["admin", "scheduler"],
  "/schedule": ["admin", "scheduler"],
  "/smart-schedule": ["admin", "scheduler"],
  "/unstaffed-shifts": ["admin", "scheduler"],
  "/staffing-requirements": ["admin", "scheduler"],
  "/constraints-report": ["admin", "scheduler"],
  "/manage-requests": ["admin", "scheduler"],
  "/published-schedule": ["admin", "scheduler", "employee"],
  "/my-area": ["admin", "scheduler", "employee"],
  "/shift-request": ["admin", "scheduler", "employee"],
  "/requests": ["admin", "scheduler", "employee"],
};
