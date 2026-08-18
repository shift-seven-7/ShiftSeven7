'use client';

import { useEffect, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

const PRESETS = ['07:00', '08:00', '12:00', '17:00'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function TimeInput({
  value,
  onChange,
  hasError,
  placeholder = 'בחר שעה',
  className,
  disabled,
}: TimeInputProps) {
  const [open, setOpen] = useState(false);
  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  const [hStr, mStr] = (value || '').split(':');
  const h = Number.parseInt(hStr ?? '', 10);
  const m = Number.parseInt(mStr ?? '', 10);
  const validH = Number.isFinite(h);
  const validM = Number.isFinite(m);

  const setH = (newH: number) =>
    onChange(`${pad2(newH)}:${pad2(validM ? m : 0)}`);
  const setM = (newM: number) =>
    onChange(`${pad2(validH ? h : 8)}:${pad2(newM)}`);

  // Auto-scroll to selected hour/minute when opened
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (validH && hourRef.current) {
        const el = hourRef.current.querySelector<HTMLElement>(`[data-h="${h}"]`);
        el?.scrollIntoView({ block: 'center' });
      }
      if (validM && minuteRef.current) {
        const el = minuteRef.current.querySelector<HTMLElement>(`[data-m="${m}"]`);
        el?.scrollIntoView({ block: 'center' });
      }
    }, 0);
    return () => clearTimeout(t);
  }, [open, h, m, validH, validM]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
              'text-start tabular-nums',
              !value && 'text-muted-foreground/50',
            )}
          >
            {value || placeholder}
          </span>
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-64 p-2.5 rounded-xl"
        dir="rtl"
      >
        <div className="flex gap-1 mb-2.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                onChange(p);
                setOpen(false);
              }}
              className={cn(
                'flex-1 h-8 rounded-md border text-xs font-semibold tabular-nums transition-colors',
                value === p
                  ? 'bg-violet-500/15 text-violet-500 border-violet-500'
                  : 'border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-stretch gap-1 h-[200px]">
          <div className="flex-1 flex flex-col">
            <div className="text-center text-[11px] font-semibold text-muted-foreground/70 py-1.5 border-b border-border/60 mb-1">
              דקות
            </div>
            <div
              ref={minuteRef}
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              className="flex-1 overflow-y-auto overscroll-contain p-0.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded"
            >
              {MINUTES.map((mm) => (
                <button
                  key={mm}
                  data-m={mm}
                  type="button"
                  onClick={() => setM(mm)}
                  className={cn(
                    'w-full h-7 rounded-md text-[13px] tabular-nums transition-colors',
                    'hover:bg-muted',
                    m === mm && 'bg-violet-600 text-white font-bold hover:bg-violet-700',
                  )}
                >
                  {pad2(mm)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center text-base font-bold text-muted-foreground px-0.5">
            :
          </div>
          <div className="flex-1 flex flex-col">
            <div className="text-center text-[11px] font-semibold text-muted-foreground/70 py-1.5 border-b border-border/60 mb-1">
              שעות
            </div>
            <div
              ref={hourRef}
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              className="flex-1 overflow-y-auto overscroll-contain p-0.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded"
            >
              {HOURS.map((hh) => (
                <button
                  key={hh}
                  data-h={hh}
                  type="button"
                  onClick={() => setH(hh)}
                  className={cn(
                    'w-full h-7 rounded-md text-[13px] tabular-nums transition-colors',
                    'hover:bg-muted',
                    h === hh && 'bg-violet-600 text-white font-bold hover:bg-violet-700',
                  )}
                >
                  {pad2(hh)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
