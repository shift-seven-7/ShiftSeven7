'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function Segmented<T extends string = string>({
  value,
  onChange,
  options,
  className,
  disabled,
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      className={cn(
        'grid gap-1 p-1 rounded-xl bg-card-elevated/60 border border-border/50',
        disabled && 'opacity-50',
        className,
      )}
    >
      {options.map((o) => {
        const Icon = o.icon;
        const isActive = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-9 min-w-0 rounded-lg flex items-center justify-center gap-1.5 md:gap-2 px-1.5 md:px-2 text-[12px] md:text-[13px] font-medium transition-all',
              isActive
                ? 'bg-violet-100/80 dark:bg-violet-500/15 text-violet-700 dark:text-violet-200 border border-violet-300 dark:border-violet-500/40 shadow-sm shadow-violet-500/10 dark:shadow-violet-900/30'
                : 'text-muted-foreground hover:text-foreground border border-transparent',
              disabled && 'cursor-not-allowed',
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
