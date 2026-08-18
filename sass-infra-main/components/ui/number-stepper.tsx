'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  hasError?: boolean;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function NumberStepper({
  value,
  onChange,
  min = 1,
  max = 999,
  hasError,
  className,
  disabled,
  ariaLabel,
}: NumberStepperProps) {
  const safeValue = Number.isFinite(value) ? value : min;
  const dec = () => onChange(Math.max(min, safeValue - 1));
  const inc = () => onChange(Math.min(max, safeValue + 1));

  return (
    <div
      className={cn(
        'flex items-center h-11 md:h-9 rounded-md overflow-hidden transition-all duration-150',
        'bg-slate-50/50 dark:bg-white/5 border border-border/50 hover:border-border/80',
        'focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20',
        hasError && 'border-red-500/70 dark:border-red-500/50',
        disabled && 'opacity-50',
        className,
      )}
    >
      <button
        type="button"
        onClick={dec}
        disabled={disabled || safeValue <= min}
        aria-label="הפחת"
        className="h-full w-11 md:w-9 inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed shrink-0"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (Number.isNaN(n)) return;
          onChange(Math.max(min, Math.min(max, n)));
        }}
        className="flex-1 min-w-0 bg-transparent border-0 outline-none text-center font-semibold text-base tabular-nums text-foreground appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
      />
      <button
        type="button"
        onClick={inc}
        disabled={disabled || safeValue >= max}
        aria-label="הוסף"
        className="h-full w-11 md:w-9 inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed shrink-0"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
