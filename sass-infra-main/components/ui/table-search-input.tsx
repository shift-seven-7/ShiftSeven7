'use client';

import { Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_MIN_LENGTH = 3;

interface TableSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  minLength?: number;
  className?: string;
}

export function TableSearchInput({
  value,
  onChange,
  isLoading = false,
  placeholder = 'חיפוש...',
  minLength = DEFAULT_MIN_LENGTH,
  className,
}: TableSearchInputProps) {
  const showHint = value.length > 0 && value.length < minLength;

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="relative flex items-center">
        {/* Search icon — right side (RTL start) */}
        <div className="absolute start-3 inset-y-0 flex items-center pointer-events-none">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        {/* Spinner — left side (RTL end), shown when loading */}
        {isLoading && (
          <div className="absolute end-3 inset-y-0 flex items-center pointer-events-none">
            <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
          </div>
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'h-9 ps-9 rounded-lg border border-border/50 bg-card/50 hover:bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 w-[200px] md:w-[250px] transition-colors',
            isLoading ? 'pe-9' : 'pe-3'
          )}
        />
      </div>
      {showHint && (
        <p className="text-xs text-muted-foreground mt-1 px-1">
          מינימום {minLength} תווים לחיפוש
        </p>
      )}
    </div>
  );
}
