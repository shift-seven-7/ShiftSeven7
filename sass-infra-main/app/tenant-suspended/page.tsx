'use client';

import { PauseCircle } from 'lucide-react';
import { APP_NAME } from '@/lib/constants/app';

/**
 * Shown when a tenant exists but its status is 'suspended'. Data is untouched —
 * access is simply blocked until an admin reactivates it.
 */
export default function TenantSuspendedPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-warning-background flex items-center justify-center">
          <PauseCircle className="w-8 h-8 text-warning" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">החשבון מושהה</h1>
          <p className="text-muted-foreground leading-relaxed">
            הגישה לחשבון הארגון הושהתה זמנית. הנתונים שלכם נשמרים במלואם. לחידוש
            הגישה, פנו לתמיכה.
          </p>
        </div>

        <p className="text-sm text-muted-foreground/70">{APP_NAME}</p>
      </div>
    </main>
  );
}
