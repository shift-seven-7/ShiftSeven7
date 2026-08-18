'use client';

import { useEffect, useState } from 'react';
import { Notice } from '@/components/ui/notice';
import { ProvisionTenantForm } from '@/components/admin/ProvisionTenantForm';
import type { BootstrapAvailability } from '@/lib/services/bootstrap';

/**
 * First-run setup — the browser equivalent of `npm run tenant:bootstrap`.
 *
 * Deliberately outside /app: it has to work with no tenant resolved and nobody
 * signed in, which is exactly the state a fresh deployment is in. The route is
 * only alive while BOOTSTRAP_TOKEN is set and the registry is empty; both
 * conditions are enforced server-side, and this screen only reflects them.
 *
 * Once a tenant exists this closes for good and /backoffice takes over.
 */
export default function BootstrapPage() {
  const [availability, setAvailability] = useState<BootstrapAvailability | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/bootstrap')
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'בדיקת הזמינות נכשלה');
        setAvailability(json as BootstrapAvailability);
      })
      .catch((err: Error) => setLoadError(err.message));
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center p-4">
      {loadError ? (
        <Notice tone="error" title="שגיאה">
          {loadError}
        </Notice>
      ) : !availability ? (
        <p className="text-center text-muted-foreground">טוען...</p>
      ) : !availability.available ? (
        <Unavailable reason={availability.reason} />
      ) : (
        <div className="space-y-4">
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-semibold text-foreground">הקמה ראשונית</h1>
            <p className="text-sm text-muted-foreground">
              יצירת הטננט הראשון. לאחר מכן הניהול עובר ל-‎/backoffice.
            </p>
          </div>

          <ProvisionTenantForm endpoint="/api/bootstrap" includeToken />
        </div>
      )}
    </div>
  );
}

function Unavailable({ reason }: { reason: 'disabled' | 'already_provisioned' }) {
  if (reason === 'already_provisioned') {
    return (
      <Notice tone="success" title="ההקמה הראשונית כבר בוצעה">
        קיים לפחות טננט אחד, ולכן המסך הזה נסגר. המשך מכאן ב-
        <a href="/backoffice" className="font-medium underline">
          {' '}
          ‎/backoffice
        </a>
        .
      </Notice>
    );
  }

  return (
    <Notice tone="warning" title="ההקמה הראשונית אינה פעילה">
      כדי להפעיל אותה, הגדר <code>BOOTSTRAP_TOKEN</code> בסביבה ופרוס מחדש. הסר אותו
      לאחר יצירת הטננט הראשון.
    </Notice>
  );
}
