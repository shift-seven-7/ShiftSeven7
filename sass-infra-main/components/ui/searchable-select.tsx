'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronDown, Search, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
  group?: string;
  leadingIcon?: LucideIcon;
  accent?: boolean;
  disabled?: boolean;
}

interface SearchableSelectProps<T extends string = string> {
  value: T | '';
  onChange: (value: T) => void;
  options: SearchableSelectOption<T>[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  hasError?: boolean;
  disabled?: boolean;
  className?: string;
  /** Override the default value rendering with custom content (e.g. icon + label). */
  renderValue?: (selected: SearchableSelectOption<T> | undefined) => ReactNode;
}

const SEARCH_THRESHOLD = 8;

export function SearchableSelect<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'בחר',
  searchable,
  searchPlaceholder = 'חיפוש...',
  emptyText = 'לא נמצאו תוצאות',
  hasError,
  disabled,
  className,
  renderValue,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD;

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!query) return options;
    const lc = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(lc));
  }, [options, query]);

  const grouped = useMemo(() => {
    const out: ({ type: 'header'; label: string } | ({ type: 'item' } & SearchableSelectOption<T>))[] = [];
    let lastGroup: string | null = null;
    for (const o of filtered) {
      if (o.group && o.group !== lastGroup) {
        out.push({ type: 'header', label: o.group });
        lastGroup = o.group;
      } else if (!o.group) {
        lastGroup = null;
      }
      out.push({ type: 'item', ...o });
    }
    return out;
  }, [filtered]);

  const pick = (next: T) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          dir="rtl"
          className={cn(
            'h-11 md:h-9 w-full rounded-md px-3 flex items-center justify-between gap-2 text-sm transition-all duration-150',
            'bg-slate-50/50 dark:bg-white/5 border border-border/50 hover:border-border/80',
            'focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none',
            'data-[state=open]:border-violet-500 data-[state=open]:ring-2 data-[state=open]:ring-violet-500/20',
            hasError && 'border-red-500/70 dark:border-red-500/50',
            disabled && 'opacity-50 cursor-not-allowed',
            className,
          )}
        >
          <span
            className={cn(
              'flex items-center gap-1.5 min-w-0 text-start truncate',
              !selected && 'text-muted-foreground/50',
              selected?.accent && 'text-violet-500 font-medium',
            )}
          >
            {renderValue
              ? renderValue(selected)
              : selected
                ? (
                  <>
                    {selected.leadingIcon && <selected.leadingIcon className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{selected.label}</span>
                  </>
                )
                : placeholder}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="p-0 rounded-xl overflow-hidden w-[var(--radix-popover-trigger-width)] min-w-[240px]"
        dir="rtl"
      >
        <div className="flex flex-col">
          {showSearch && (
            <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-border/60 shrink-0">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                dir="rtl"
                className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[13px] text-foreground placeholder:text-muted-foreground/50 text-start"
                autoFocus
              />
              <Search className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
            </div>
          )}
          <ul
            role="listbox"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            className="list-none m-0 p-1.5 overflow-y-auto overscroll-contain max-h-[280px]"
          >
            {grouped.length === 0 && (
              <li className="px-2.5 py-3 text-center text-[13px] text-muted-foreground/70">
                {emptyText}
              </li>
            )}
            {grouped.map((row, i) =>
              row.type === 'header' ? (
                <li
                  key={`h-${i}-${row.label}`}
                  className="px-2 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground/70"
                >
                  {row.label}
                </li>
              ) : (
                <li
                  key={`o-${row.value}`}
                  role="option"
                  aria-selected={row.value === value}
                  aria-disabled={row.disabled}
                  onClick={() => !row.disabled && pick(row.value)}
                  className={cn(
                    'flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-[13.5px] cursor-pointer transition-colors',
                    'hover:bg-muted',
                    row.value === value && 'bg-violet-500/15 text-violet-500 font-semibold hover:bg-violet-500/15',
                    row.accent && row.value !== value && 'text-violet-500 font-semibold',
                    row.disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent',
                  )}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    {row.leadingIcon && <row.leadingIcon className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{row.label}</span>
                  </span>
                  {row.value === value ? (
                    <Check className="h-4 w-4 text-violet-500 shrink-0" />
                  ) : row.hint ? (
                    <span className="text-[11.5px] text-muted-foreground/70 shrink-0">{row.hint}</span>
                  ) : null}
                </li>
              ),
            )}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
