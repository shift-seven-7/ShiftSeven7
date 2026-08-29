'use client';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  /** Buttons for the header row — rendered on the end edge (left in RTL). */
  actions?: React.ReactNode;
  isLoading?: boolean;
  /** Drop the max-width clamp, for tables and boards that want the room. */
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Standard page frame: title row, then content. Every page under /app uses it,
 * so headings and spacing stay consistent without each page re-deriving them.
 */
export function PageLayout({
  title,
  subtitle,
  actions,
  isLoading,
  fullWidth,
  className,
  children,
}: PageLayoutProps) {
  return (
    <div className={cn('mx-auto w-full p-4 md:p-6', !fullWidth && 'max-w-6xl', className)}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-foreground md:text-2xl">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        children
      )}
    </div>
  );
}
