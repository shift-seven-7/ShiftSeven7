'use client';

import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingActionButtonProps {
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  className?: string;
}

export function FloatingActionButton({
  onClick,
  icon,
  label,
  className,
}: FloatingActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-20 end-4 z-40 md:hidden',
        'h-14 w-14 rounded-full',
        'bg-primary text-primary-foreground',
        'shadow-lg shadow-primary/25',
        'flex items-center justify-center',
        'active:scale-95 transition-transform',
        className
      )}
      aria-label={label}
    >
      {icon || <Plus className="h-6 w-6" />}
    </button>
  );
}
