import { Outlet, Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, Users, Clock, Shield, Settings, SlidersHorizontal,
  ChevronLeft, ChevronRight, CalendarDays, CalendarCheck, ClipboardList, AlertCircle, FileWarning, ClipboardCheck, Inbox
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useImpersonation } from "@/lib/ImpersonationContext";
import { ROUTE_ACCESS } from "@/lib/routePermissions";
import UserSwitcher from "@/components/UserSwitcher";
import ImpersonationBanner from "@/components/ImpersonationBanner";

const adminNavItems = [
  { path: "/", label: "לוח בקרה", icon: LayoutDashboard },
  { path: "/staff", label: "צוות העובדים", icon: Users },
  { path: "/shifts", label: "תבניות משמרת", icon: Clock },
  { path: "/smart-schedule", label: "סידור חכם", icon: CalendarDays },
  { path: "/published-schedule", label: "סידור סופי", icon: CalendarCheck },
  { path: "/unstaffed-shifts", label: "פערי סידור", icon: AlertCircle },
  { path: "/staffing-requirements", label: "תקינת כיסוי", icon: SlidersHorizontal },
  { path: "/manage-requests", label: "ניהול בקשות", icon: ClipboardCheck },
  { path: "/constraints-report", label: "דוח אילוצים", icon: FileWarning },
  { path: "/settings", label: "הגדרות", icon: Settings },
];

const staffNavItems = [
  { path: "/my-area", label: "האזור שלי", icon: LayoutDashboard },
  { path: "/shift-request", label: "הגשת אילוצים ומשמרות", icon: ClipboardList },
  { path: "/requests", label: "בקשות וחופשות", icon: Inbox },
  { path: "/published-schedule", label: "סידור עבודה סופי", icon: CalendarCheck },
];

export default function Layout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { effectiveAccessLevel } = useImpersonation();

  const baseNavItems = ["admin", "scheduler"].includes(effectiveAccessLevel) ? adminNavItems : staffNavItems;
  const navItems = baseNavItems.filter((item) => ROUTE_ACCESS[item.path]?.includes(effectiveAccessLevel));

  return (
    <div className="flex h-screen overflow-hidden bg-background" dir="rtl">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-card transition-all duration-300 ease-in-out",
          collapsed ? "w-[68px]" : "w-[250px]"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold tracking-tight truncate">SecureShift</h1>
              <p className="text-[10px] text-muted-foreground truncate">ניהול משמרות</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User / impersonation switcher */}
        <div className="p-2 border-t border-border shrink-0">
          <UserSwitcher collapsed={collapsed} />
        </div>

        {/* Collapse button */}
        <div className="p-2 border-t border-border shrink-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <ImpersonationBanner />
        <Outlet />
      </main>
    </div>
  );
}