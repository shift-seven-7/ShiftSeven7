import { AlertTriangle, Check, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A short block of consequence — "this worked", "this is why it will not".
 *
 * Not a toast: toasts are for things that happened, this is for a state the
 * screen is currently in and the reader needs to act on.
 */
export function Notice({
  tone = 'info',
  title,
  className,
  children,
}: {
  tone?: 'success' | 'warning' | 'error' | 'info';
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    success: 'bg-success-background text-success',
    warning: 'bg-warning-background text-warning',
    error: 'bg-error-background text-error',
    info: 'bg-muted text-muted-foreground',
  } as const;

  const Icon = tone === 'success' ? Check : tone === 'info' ? Info : AlertTriangle;

  return (
    <div className={cn('flex items-start gap-2 rounded-lg p-4 text-sm', tones[tone], className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-medium">{title}</p>}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
