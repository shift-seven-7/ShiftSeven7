"use client";

import { signOut } from "@/app/actions/auth";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import UserSwitcher from "@/components/UserSwitcher";
import { useImpersonation } from "@/lib/impersonation-context";
import { ROUTE_ACCESS } from "@/lib/routePermissions";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileWarning,
  Inbox,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

const adminNavItems: NavItem[] = [
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

const staffNavItems: NavItem[] = [
  { path: "/my-area", label: "האזור שלי", icon: LayoutDashboard },
  { path: "/shift-request", label: "הגשת אילוצים ומשמרות", icon: ClipboardList },
  { path: "/requests", label: "בקשות וחופשות", icon: Inbox },
  { path: "/published-schedule", label: "סידור עבודה סופי", icon: CalendarCheck },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { effectiveAccessLevel } = useImpersonation();

  const baseNavItems = ["admin", "scheduler"].includes(effectiveAccessLevel ?? "") ? adminNavItems : staffNavItems;
  const navItems = baseNavItems.filter((item) => ROUTE_ACCESS[item.path]?.includes(effectiveAccessLevel!));

  return (
    <div className="flex h-screen overflow-hidden bg-background" dir="rtl">
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-card transition-all duration-300 ease-in-out",
          collapsed ? "w-[68px]" : "w-[250px]",
        )}
      >
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

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-border shrink-0">
          <UserSwitcher collapsed={collapsed} />
        </div>

        <div className="p-2 border-t border-border shrink-0 flex items-center gap-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center flex-1 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          {!collapsed && (
            <form action={signOut}>
              <button
                type="submit"
                title="התנתק"
                className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <ImpersonationBanner />
        {children}
      </main>
    </div>
  );
}
