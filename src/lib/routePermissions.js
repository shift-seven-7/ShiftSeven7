// Single source of truth for which Staff.access_level tiers may reach which route.
// Consumed by both the sidebar (Layout.jsx) and the route guard (RequireAccess.jsx)
// so nav visibility and actual access can never drift apart.
export const ROUTE_ACCESS = {
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
