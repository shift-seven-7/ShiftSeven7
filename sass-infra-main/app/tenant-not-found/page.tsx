'use client';

import { Building2 } from 'lucide-react';
import { APP_NAME } from '@/lib/constants/app';

/**
 * Shown when the Host header carries no known tenant subdomain — a typo, a
 * deleted tenant, or a request to the apex domain on a protected path.
 */
export default function TenantNotFoundPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <Building2 className="w-8 h-8 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">הארגון לא נמצא</h1>
          <p className="text-muted-foreground leading-relaxed">
            הכתובת שהזנת אינה משויכת לארגון פעיל במערכת. בדוק את הכתובת, או פנה
            למנהל המערכת בארגון שלך.
          </p>
        </div>

        <p className="text-sm text-muted-foreground/70">{APP_NAME}</p>
      </div>
    </main>
  );
}
