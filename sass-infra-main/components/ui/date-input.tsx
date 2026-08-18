'use client';

import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toLocalDateKey, isSameDay } from '@/lib/date-utils';

const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const HE_DOW_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatDisplay(d: Date) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function parseISODate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfMonthGrid(y: number, m: number) {
  const first = new Date(y, m, 1);
  const dow = first.getDay();
  return new Date(y, m, 1 - dow);
}

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  hasError?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DateInput({
  value,
  onChange,
  onBlur,
  hasError,
  placeholder = 'בחר תאריך',
  className,
  disabled,
}: DateInputProps) {
  const [open, setOpen] = useState(false);
  const selected = parseISODate(value);
  const initialView = selected || new Date();
  const [view, setView] = useState({ y: initialView.getFullYear(), m: initialView.getMonth() });

  const cells = useMemo(() => {
    const start = startOfMonthGrid(view.y, view.m);
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
  }, [view]);

  const today = new Date();

  const goPrev = () =>
    setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  const goNext = () =>
    setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));

  const pick = (d: Date) => {
    onChange(toLocalDateKey(d));
    setOpen(false);
    onBlur?.();
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) onBlur?.();
    if (next && selected) setView({ y: selected.getFullYear(), m: selected.getMonth() });
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
            hasError && 'border-red-500/70 dark:border-red-500/50 focus:border-red-500 focus:ring-red-500/20',
            disabled && 'opacity-50 cursor-not-allowed',
            className,
          )}
        >
          <span
            className={cn(
              'text-start tabular-nums',
              !selected && 'text-muted-foreground/50',
            )}
          >
            {selected ? formatDisplay(selected) : placeholder}
          </span>
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[296px] p-3 rounded-xl"
        dir="rtl"
      >
        <div className="flex items-center justify-between mb-2.5">
          <button
            type="button"
            onClick={goNext}
            aria-label="חודש הבא"
            className="h-7 w-7 rounded-md border border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center justify-center transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="text-sm font-semibold tabular-nums">
            {HE_MONTHS[view.m]} {view.y}
          </div>
          <button
            type="button"
            onClick={goPrev}
            aria-label="חודש קודם"
            className="h-7 w-7 rounded-md border border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {HE_DOW_SHORT.map((d, i) => (
            <div
              key={i}
              className="text-center text-[11px] font-semibold text-muted-foreground/70 py-1.5"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === view.m;
            const isToday = isSameDay(d, today);
            const isSel = selected && isSameDay(d, selected);
            return (
              <button
                key={i}
                type="button"
                onClick={() => pick(d)}
                className={cn(
                  'aspect-square rounded-md text-[13px] font-medium tabular-nums transition-colors',
                  'hover:bg-muted',
                  !inMonth && 'text-muted-foreground/55',
                  isToday && !isSel && 'ring-1 ring-inset ring-violet-500 text-violet-500',
                  isSel && 'bg-violet-600 text-white font-bold hover:bg-violet-700',
                )}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1.5 mt-2.5 pt-2.5 border-t border-border/60">
          <button
            type="button"
            onClick={() => {
              const t = new Date();
              setView({ y: t.getFullYear(), m: t.getMonth() });
              pick(t);
            }}
            className="flex-1 h-7 rounded-md border border-border/60 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            היום
          </button>
          <button
            type="button"
            onClick={() => {
              const t = new Date();
              t.setDate(t.getDate() - 1);
              setView({ y: t.getFullYear(), m: t.getMonth() });
              pick(t);
            }}
            className="flex-1 h-7 rounded-md border border-border/60 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            אתמול
          </button>
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
              onBlur?.();
            }}
            className="flex-1 h-7 rounded-md border border-border/60 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            נקה
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
