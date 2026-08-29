'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { MobileNavItem } from './MobileNavContext';

interface MobileNavListProps {
  items: MobileNavItem[];
  title?: string;
  onNavigate?: () => void;
}

/**
 * The mobile drawer's content when a module has registered its own nav via
 * useRegisterMobileNav — deliberately dumb (no route-matching, no collapse
 * state, no tenant branding): just rows, styled to match the platform
 * Sidebar's own so the drawer looks the same regardless of which list is in
 * it. `isActive` comes from the caller so this component stays domain-blind.
 */
export function MobileNavList({ items, title, onNavigate }: MobileNavListProps) {
  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3" aria-label={title ?? 'ניווט'}>
      {title && (
        <div className="mb-2 flex h-16 items-center border-b border-border px-3 -mt-3 text-sm font-semibold text-foreground">
          {title}
        </div>
      )}
      {items.map((item) => {
        const Icon = item.icon;

        if (item.disabled) {
          return (
            <span
              key={item.href}
              title="בפיתוח"
              className="flex min-h-[44px] cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground/40"
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{item.label}</span>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              item.isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
