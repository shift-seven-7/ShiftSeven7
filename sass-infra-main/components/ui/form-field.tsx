'use client';

import { AlertCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  icon: LucideIcon;
  label: string;
  required?: boolean;
  error?: string | null | false;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Chrome-less form field — label row above the control with the icon on the
 * end edge (left in RTL) and the label text + required marker on the start
 * edge (right in RTL). The bordered/backgrounded element is the control
 * itself, never this wrapper. See `.claude/skills/form-dialogs/SKILL.md` for
 * the full pattern.
 */
export function FormField({
  icon: Icon,
  label,
  required,
  error,
  hint,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('group/field flex flex-col', className)}>
      <label className="flex items-center justify-between gap-2 mb-2 text-[12.5px] font-semibold text-muted-foreground group-focus-within/field:text-foreground transition-colors">
        <span className="inline-flex items-center gap-1">
          {label}
          {required && (
            <span className="text-red-500 dark:text-red-400 ms-1 font-bold">*</span>
          )}
        </span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 group-focus-within/field:text-violet-500 transition-colors" />
      </label>
      <div>{children}</div>
      {error ? (
        <p className="mt-1.5 text-[11.5px] text-red-500 dark:text-red-400 inline-flex items-center gap-1 font-medium">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[11.5px] text-muted-foreground/70">{hint}</p>
      ) : null}
    </div>
  );
}
