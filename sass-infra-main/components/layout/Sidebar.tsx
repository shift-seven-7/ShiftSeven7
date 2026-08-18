'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Building2,
  CalendarClock,
  ChevronRight,
  Home,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { USER_ROLES, type UserRole } from '@/types/roles';
import { TENANT_ADMIN_ROLES } from '@/lib/constants/roles';
import { APP_NAME_HE } from '@/lib/constants/app';
import { FEATURE_KEYS, type FeatureKey } from '@/lib/constants/features';

/**
 * Primary navigation.
 *
 * ── ADDING A MODULE'S NAV ITEM ───────────────────────────────────────────────
 * Add an entry to getNavItems() with `feature: FEATURE_KEYS.X`. It then appears
 * only for tenants that have the module and roles listed in `roles`. This is
 * step 4 of the five in lib/constants/features.ts.
 */

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Roles that see this item. */
  roles: UserRole[];
  /** Module required for this item. Omit for always-on infrastructure pages. */
  feature?: FeatureKey;
  /** Platform-operator only — a tenant admin is not enough. */
  operatorOnly?: boolean;
}

const ALL_ROLES: UserRole[] = [USER_ROLES.ADMIN, USER_ROLES.SYSTEM_MANAGER];

/** Platform roles plus a module's own low-privilege users (e.g. Shift7's STAFF). */
const ALL_ROLES_INCLUDING_STAFF: UserRole[] = [...ALL_ROLES, USER_ROLES.STAFF];

/**
 * A function, not a constant, so labels can depend on runtime configuration if
 * a project ever needs that.
 */
function getNavItems(): NavItem[] {
  return [
    { href: '/app/home', label: 'עמוד הבית', icon: Home, roles: ALL_ROLES },
    { href: '/app/users', label: 'משתמשים', icon: Users, roles: ALL_ROLES },
    { href: '/app/settings', label: 'הגדרות מערכת', icon: Settings, roles: ALL_ROLES },
    {
      href: '/app/admin/tenants',
      label: 'ניהול טננטים',
      icon: Building2,
      roles: TENANT_ADMIN_ROLES,
      // The platform's own console, not the tenant's. A customer's ADMIN must
      // not see it — see lib/auth/platform.ts.
      operatorOnly: true,
    },

    {
      href: '/app/shift7',
      label: 'Shift7',
      icon: CalendarClock,
      roles: ALL_ROLES_INCLUDING_STAFF,
      feature: FEATURE_KEYS.SHIFT7,
    },
  ];
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  /** Mobile drawer: closes the drawer after navigating. */
  onNavigate?: () => void;
}

export function Sidebar({ isCollapsed, onToggleCollapse, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { role, tenant, isFeatureEnabled, isPlatformOperator } = usePermissions();

  const items = getNavItems().filter((item) => {
    if (!role || !item.roles.includes(role)) return false;
    if (item.feature && !isFeatureEnabled(item.feature)) return false;
    if (item.operatorOnly && !isPlatformOperator) return false;
    return true;
  });

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-normal',
        isCollapsed ? 'w-[72px]' : 'w-[280px]'
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        {tenant?.logoUrl ? (
          <Image
            src={tenant.logoUrl}
            alt={tenant.name}
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-lg object-contain"
            unoptimized
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Building2 className="h-4 w-4" />
          </div>
        )}

        {!isCollapsed && (
          <span className="truncate text-sm font-semibold">
            {tenant?.name || APP_NAME_HE}
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                'min-h-[44px]', // touch target
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                isCollapsed && 'justify-center px-0'
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={isCollapsed ? 'הרחבת התפריט' : 'כיווץ התפריט'}
        className="hidden h-12 items-center justify-center border-t border-sidebar-border text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground lg:flex"
      >
        {/* RTL: the chevron points the way the panel will move. */}
        <ChevronRight className={cn('h-4 w-4 transition-transform', isCollapsed && 'rotate-180')} />
      </button>
    </aside>
  );
}
