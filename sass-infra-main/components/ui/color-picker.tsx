'use client';

import { HexColorInput, HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Swatch button that opens a free-form gradient + hue picker (react-colorful)
 * in a popover, with a synced hex field. For an arbitrary per-record color
 * (e.g. a shift template's color) - not the small fixed brand palette in
 * AppearanceSettingsTab, which is a different picker for a different job.
 */
export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-9 w-9 shrink-0 rounded-md border border-input shadow-sm transition-transform hover:scale-105"
            style={{ backgroundColor: value }}
            aria-label="בחירת צבע"
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto space-y-3 p-3" align="start">
          <HexColorPicker color={value} onChange={onChange} />
          <HexColorInput
            color={value}
            onChange={onChange}
            prefixed
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-center text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </PopoverContent>
      </Popover>
      <span className="font-mono text-sm text-muted-foreground">{value}</span>
    </div>
  );
}
