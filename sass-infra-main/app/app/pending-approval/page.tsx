'use client';

import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePermissions } from '@/lib/hooks/usePermissions';

/**
 * Where a user with no role yet waits.
 *
 * `app_role IS NULL` is the normal state after a self-registration: the account
 * is real and confirmed, it simply has no permissions until an admin assigns a
 * role on the users page.
 */
export default function PendingApprovalPage() {
  const { user } = usePermissions();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/auth/login';
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 pt-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-background">
            <Clock className="h-7 w-7 text-warning" />
          </div>

          <h1 className="text-lg font-semibold text-foreground">החשבון ממתין לאישור</h1>

          <p className="text-sm leading-relaxed text-muted-foreground">
            נרשמת בהצלחה
            {user?.email
              ? ` עם הכתובת ${user.email}`
              : user?.phone
                ? ` עם המספר ${user.phone}`
                : ''}
            . מנהל המערכת
            בארגון צריך לאשר את החשבון ולשייך לך תפקיד. תקבל גישה מיד לאחר מכן.
          </p>

          <Button variant="outline" className="w-full" onClick={handleLogout}>
            התנתקות
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
