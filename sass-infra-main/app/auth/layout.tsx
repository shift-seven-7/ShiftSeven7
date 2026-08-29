import { APP_NAME } from '@/lib/constants/app';

/**
 * Centred card shell shared by every auth screen.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-8 text-xs text-muted-foreground/60">{APP_NAME}</p>
    </div>
  );
}
