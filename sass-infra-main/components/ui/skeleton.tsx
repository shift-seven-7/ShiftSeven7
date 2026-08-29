import * as React from 'react';

import { cn } from '@/lib/utils';

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('skeleton rounded-md', className)} {...props} />
  )
);
Skeleton.displayName = 'Skeleton';

/**
 * Feature Card Skeleton - matches the new card design with banner
 */
function FeatureCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-card border border-border rounded-2xl overflow-hidden shadow-card',
        className
      )}
    >
      {/* Banner skeleton */}
      <div className="p-6 bg-muted/50">
        <Skeleton className="h-6 w-20 rounded-lg mb-4" />
        <Skeleton className="h-7 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      {/* Content skeleton */}
      <div className="p-6 space-y-4">
        <Skeleton className="h-4 w-full" />
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-8" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl border border-border/50 bg-card-elevated/30">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-8 w-10" />
          </div>
          <div className="p-4 rounded-xl border border-border/50 bg-card-elevated/30">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-8 w-10" />
          </div>
        </div>
        {/* Date row */}
        <Skeleton className="h-4 w-32" />
        {/* Button */}
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}

function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-card border border-border rounded-2xl p-6 shadow-card',
        className
      )}
    >
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-12" />
        </div>
      </div>
    </div>
  );
}

function ListItemSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-4 border border-border rounded-xl',
        className
      )}
    >
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-4" />
      </div>
    </div>
  );
}

function SectionSkeleton({
  itemCount = 3,
  className,
}: {
  itemCount?: number;
  className?: string;
}) {
  return (
    <div className={cn('bg-card border border-border rounded-2xl p-6 shadow-card', className)}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-9 w-20 rounded-xl" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: itemCount }).map((_, i) => (
          <ListItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function CompoundCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('bg-card border border-border rounded-2xl p-6 shadow-card', className)}>
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-4 w-4" />
      </div>
      <Skeleton className="h-5 w-28 mb-2" />
      <Skeleton className="h-4 w-full mb-4" />
      <div className="flex items-center gap-4 pt-4 border-t border-border/50">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-2 flex-1 rounded-full" />
        <Skeleton className="h-4 w-8" />
      </div>
    </div>
  );
}

function ContractorCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('bg-card border border-border rounded-2xl p-6 shadow-card', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    </div>
  );
}

function CompoundStatsSkeleton() {
  return (
    <div className="flex items-center gap-4 text-sm">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-2 flex-1 rounded-full" />
      <Skeleton className="h-4 w-8" />
    </div>
  );
}

/**
 * Task Card Skeleton - compact version for task lists
 */
function TaskCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-card border border-border rounded-2xl p-4 shadow-card',
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full mb-3" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export {
  Skeleton,
  FeatureCardSkeleton,
  StatCardSkeleton,
  ListItemSkeleton,
  SectionSkeleton,
  CompoundCardSkeleton,
  ContractorCardSkeleton,
  CompoundStatsSkeleton,
  TaskCardSkeleton,
};
