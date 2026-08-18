'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'בחר...',
  className,
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((v) => v !== value));
  };

  const selectedLabels = selected.map((value) => {
    const option = options.find((o) => o.value === value);
    return option?.label || value;
  });

  return (
    <Popover open={disabled ? false : open} onOpenChange={(v) => !disabled && setOpen(v)}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between h-auto min-h-9 px-3 py-2',
            disabled && 'opacity-60 cursor-not-allowed',
            className
          )}
        >
          <div className="flex flex-wrap gap-1">
            {selected.length === 0 && (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            {selectedLabels.map((label, index) => (
              <Badge
                key={selected[index]}
                variant="secondary"
                className="text-xs"
              >
                {label}
                <button
                  type="button"
                  className="ms-1 hover:text-destructive"
                  onClick={(e) => handleRemove(selected[index], e)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ms-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="max-h-60 overflow-auto p-1">
          {options.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              אין אפשרויות זמינות
            </div>
          ) : (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={cn(
                  'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pe-8 ps-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                  selected.includes(option.value) && 'bg-accent'
                )}
              >
                <span className="flex-1 text-start">{option.label}</span>
                {selected.includes(option.value) && (
                  <Check className="absolute end-2 h-4 w-4" />
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
