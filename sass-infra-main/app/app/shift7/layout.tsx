'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertCircle,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileWarning,
  Inbox,
  LayoutDashboard,
  Settings,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMyShift7Staff } from '@/hooks/queries/useMyShift7Staff';
import { useRegisterMobileNav } from '@/components/layout/MobileNavContext';
import type { Shift7AccessLevel } from '@/types/database.types';

/**
 * Shift7's own persistent sub-navigation, shown across every /app/shift7/*
 * page — mirrors web/'s Layout.tsx: a vertical nav rail, not a top bar (the
 * first cut of this used a horizontal strip and got corrected). Two
 * role-based lists filtered by ROUTE_ACCESS-equivalent logic, same as
 * web/'s, so each Shift7 access level reaches the same set of pages it did
 * there. Styled with this platform's own tokens rather than porting web/'s
 * literal markup — Shift7 stays visually consistent with the rest of the
 * app, but the nav is positioned and structured the way web/'s was.
 *
 * Nested beside the platform's own Sidebar (one "Shift7" entry there, per
 * the `modules` skill's one-item-per-module norm) rather than replacing it —
 * this is the module's OWN nav, one level in, matching web/'s single sidebar
 * only insofar as it's ALSO a vertical rail; the platform's module-switching
 * nav is a separate, permanent layer above it.
 *
 * Vertical rail on lg+. Below that there's no room for a second nav surface
 * on the page itself (a horizontal strip was tried and read as a second,
 * disconnected menu from the platform hamburger) — instead this registers
 * itself as the platform mobile drawer's content via useRegisterMobileNav,
 * so the hamburger opens one menu with the real routes, not the generic
 * platform Sidebar's near-empty list.
 */

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  comingSoon?: boolean;
}

const ADMIN_SCHEDULER_NAV: NavItem[] = [
  { href: '/app/shift7', label: 'לוח בקרה', icon: LayoutDashboard },
  { href: '/app/shift7/staff', label: 'צוות העובדים', icon: Users },
  { href: '/app/shift7/shift-templates', label: 'תבניות משמרת', icon: Clock },
  { href: '/app/shift7/smart-schedule', label: 'סידור חכם', icon: CalendarDays },
  { href: '/app/shift7/published-schedule', label: 'סידור סופי', icon: CalendarCheck },
  { href: '/app/shift7/unstaffed-shifts', label: 'פערי סידור', icon: AlertCircle },
  { href: '/app/shift7/staffing-requirements', label: 'תקינת כיסוי', icon: SlidersHorizontal },
  { href: '/app/shift7/manage-requests', label: 'ניהול בקשות', icon: ClipboardCheck },
  { href: '/app/shift7/constraints-report', label: 'דוח אילוצים', icon: FileWarning },
  { href: '/app/shift7/posts', label: 'עמדות שמירה', icon: Users },
];

const ADMIN_ONLY_NAV: NavItem[] = [
  { href: '/app/shift7/settings', label: 'הגדרות', icon: Settings },
];

const EMPLOYEE_NAV: NavItem[] = [
  { href: '/app/shift7/my-area', label: 'האזור שלי', icon: LayoutDashboard },
  { href: '/app/shift7/shift-request', label: 'הגשת אילוצים ומשמרות', icon: ClipboardList },
  { href: '/app/shift7/requests', label: 'בקשות וחופשות', icon: Inbox },
  { href: '/app/shift7/published-schedule', label: 'סידור עבודה סופי', icon: CalendarCheck },
];

function navFor(accessLevel: Shift7AccessLevel | undefined): NavItem[] {
  if (accessLevel === 'admin') return [...ADMIN_SCHEDULER_NAV, ...ADMIN_ONLY_NAV];
  if (accessLevel === 'scheduler') return ADMIN_SCHEDULER_NAV;
  if (accessLevel === 'employee') return EMPLOYEE_NAV;
  return [];
}

/**
 * A prefix match (pathname under item.href/...) only counts as "active" when
 * no *other* item in the same nav owns that subtree — otherwise the root
 * item (e.g. "/app/shift7") would light up for every one of its siblings'
 * pages too, so two tabs stay highlighted at once when you navigate between
 * them. Exact-path matches are always active regardless.
 */
function isNavItemActive(pathname: string, href: string, allHrefs: string[]): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  return !allHrefs.some((other) => other !== href && other.startsWith(`${href}/`));
}

export default function Shift7Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: myStaff } = useMyShift7Staff();

  const items = navFor(myStaff?.access_level);
  const allHrefs = items.map((i) => i.href);
  const activeItems = items.map((item) => ({
    ...item,
    isActive: isNavItemActive(pathname, item.href, allHrefs),
    disabled: item.comingSoon,
  }));

  // Hooks must run unconditionally — the "nothing to show" early return
  // below happens after this, so the drawer still gets cleared (null) for
  // a bootstrap-pending/no_access staff row with nothing valid to list.
  useRegisterMobileNav(activeItems.length > 0 ? activeItems : null, 'Shift7');

  if (items.length === 0) {
    // No staff row yet (bootstrap pending) or no_access — let the page itself
    // render the right state (bootstrap card / "no permission" message)
    // without a nav that has nothing valid to show.
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      {/* Desktop: vertical rail, flush against the platform Sidebar. Same
          breakpoint as AppShell's own Sidebar (hidden lg:block) — the two
          must appear/disappear together, or there's a width range where the
          platform Sidebar is gone but this is still showing (or vice versa),
          which is what "2 menus" turned out to be: not two navs stacked, a
          mismatched breakpoint leaving a half-and-half state. Below lg, this
          module's nav lives in the platform mobile drawer instead — see
          useRegisterMobileNav above. */}
      <nav
        className="hidden shrink-0 flex-col gap-1 border-e border-border/60 p-3 lg:flex lg:w-[220px]"
        aria-label="ניווט Shift7"
      >
        {activeItems.map((item) => (
          <Shift7NavLink key={item.href} item={item} isActive={item.isActive} />
        ))}
      </nav>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Shift7NavLink({
  item,
  isActive,
}: {
  item: NavItem;
  isActive: boolean;
}) {
  const Icon = item.icon;

  if (item.comingSoon) {
    return (
      <span
        title="בפיתוח"
        className="flex shrink-0 cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground/40"
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
