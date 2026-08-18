'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PageTab<T extends string = string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface PageTabsProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  tabs: PageTab<T>[];
  className?: string;
  ariaLabel?: string;
}

/**
 * Page-level tab bar — the full-width violet segmented bar used to switch
 * between the main views of a page (procurement requests/orders, attendance
 * regular/daily).
 *
 * Distinct from `components/ui/segmented.tsx`, which is the *form control*
 * variant: smaller, grid-based, icons always visible. Keep them separate — this
 * one is wider, taller on mobile, and hides its icons below `md`.
 */
export function PageTabs<T extends string = string>({
  value,
  onChange,
  tabs,
  className,
  ariaLabel,
}: PageTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex gap-2 p-1 rounded-lg bg-slate-50/20 dark:bg-muted/40 border border-border/30 dark:border-border/40',
        className,
      )}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={cn(
              'flex-1 px-4 py-2 min-h-[44px] md:min-h-0 md:py-1.5 text-sm font-medium rounded-md transition-all duration-150 flex items-center justify-center gap-1.5',
              isActive
                ? 'bg-violet-500/10 dark:bg-violet-500/15 border border-violet-500/30 text-violet-700 dark:text-violet-300 shadow-sm shadow-violet-500/5'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.08] border border-transparent',
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5 hidden md:inline-block" />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
