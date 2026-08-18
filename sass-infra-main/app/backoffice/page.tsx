'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, LogOut, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { ProvisionTenantForm } from '@/components/admin/ProvisionTenantForm';
import { BASE_DOMAIN, tenantHref } from '@/lib/constants/domain';
import { STATUS_LABELS, PLAN_LABELS, type TenantListItem } from '@/types/tenant.types';
import type { BackofficeSession } from '@/app/api/backoffice/session/route';

/**
 * The platform console — the operator's entry point, independent of any tenant.
 *
 * Signs in against the MASTER project with Google, which is what lets it work
 * on the apex domain where no tenant resolves. Authorization is the
 * PLATFORM_OPERATOR_EMAILS allow-list; see lib/auth/platform.ts for why it is
 * strict here and lenient in the in-tenant console.
 *
 * Everything on screen is UI. `/api/admin/tenants/**` re-checks the session on
 * every call.
 */
export default function BackofficePage() {
  const [session, setSession] = useState<BackofficeSession | null>(null);
  const [tenants, setTenants] = useState<TenantListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const loadTenants = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/tenants');
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'טעינת הטננטים נכשלה');
      setTenants(json.tenants as TenantListItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'טעינת הטננטים נכשלה');
    }
  }, []);

  useEffect(() => {
    fetch('/api/backoffice/session')
      .then((response) => response.json())
      .then((json: BackofficeSession) => {
        setSession(json);
        if (json.authorized) void loadTenants();
      })
      .catch(() => setError('בדיקת ההתחברות נכשלה'));
  }, [loadTenants]);

  async function handleSignIn() {
    setIsSigningIn(true);
    setError(null);

    try {
      const response = await fetch('/api/backoffice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: window.location.origin }),
      });

      const json = await response.json();
      if (!response.ok || !json.url) throw new Error(json.error || 'ההתחברות נכשלה');

      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ההתחברות נכשלה');
      setIsSigningIn(false);
    }
  }

  async function handleSignOut() {
    await fetch('/api/backoffice/session', { method: 'DELETE' });
    window.location.reload();
  }

  if (!session) {
    return <Centered>טוען...</Centered>;
  }

  // ── not configured ────────────────────────────────────────────────────────
  if (!session.configured) {
    return (
      <Centered>
        <Notice tone="warning" title="הבאק-אופיס אינו מוגדר">
          התחברות האופרטור עובדת מול פרויקט המאסטר. הגדר{' '}
          <code>MASTER_SUPABASE_ANON_KEY</code>, הפעל את ספק Google בפרויקט המאסטר, ופרוס
          מחדש. ראה <code>docs/deployment.md</code>.
        </Notice>
      </Centered>
    );
  }

  // ── signed out ────────────────────────────────────────────────────────────
  if (!session.email) {
    return (
      <Centered>
        <div className="space-y-4">
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-semibold text-foreground">ניהול הפלטפורמה</h1>
            <p className="text-sm text-muted-foreground">כניסה למורשים בלבד</p>
          </div>

          {!session.hasAllowList && (
            <Notice tone="warning" title="לא הוגדרה רשימת מורשים">
              בלי <code>PLATFORM_OPERATOR_EMAILS</code> אף אחד לא יאושר כאן — גם לא אתה.
            </Notice>
          )}

          {error && <p className="text-center text-sm text-error">{error}</p>}

          <Button className="w-full gap-2" onClick={handleSignIn} disabled={isSigningIn}>
            <GoogleMark />
            {isSigningIn ? 'מתחבר...' : 'המשך עם Google'}
          </Button>
        </div>
      </Centered>
    );
  }

  // ── signed in, not on the list ────────────────────────────────────────────
  if (!session.authorized) {
    return (
      <Centered>
        <div className="space-y-4">
          <Notice tone="error" title="אין הרשאה">
            נכנסת כ-<span dir="ltr">{session.email}</span>, והכתובת הזו אינה ברשימת
            המורשים. הוסף אותה ל-<code>PLATFORM_OPERATOR_EMAILS</code> ופרוס מחדש, או
            התחבר בחשבון אחר.
          </Notice>

          <Button variant="outline" className="w-full gap-2" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            התנתקות
          </Button>
        </div>
      </Centered>
    );
  }

  // ── the console ───────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">ניהול הפלטפורמה</h1>
          <p className="text-sm text-muted-foreground" dir="ltr">
            {session.email}
          </p>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={() => setIsCreating((open) => !open)} className="gap-2">
            <Plus className="h-4 w-4" />
            {isCreating ? 'ביטול' : 'טננט חדש'}
          </Button>
          <Button size="sm" variant="outline" onClick={handleSignOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            התנתקות
          </Button>
        </div>
      </header>

      {isCreating && (
        <ProvisionTenantForm
          endpoint="/api/admin/tenants/create-automated"
          onProvisioned={() => void loadTenants()}
        />
      )}

      {error && <Notice tone="error">{error}</Notice>}

      {!tenants ? (
        <p className="text-muted-foreground">טוען טננטים...</p>
      ) : tenants.length === 0 ? (
        <Notice tone="info" title="אין עדיין טננטים">
          צור את הראשון בכפתור ״טננט חדש״.
        </Notice>
      ) : (
        <div className="space-y-2">
          {tenants.map((tenant) => (
            <TenantRow key={tenant.id} tenant={tenant} />
          ))}
        </div>
      )}
    </div>
  );
}

function TenantRow({ tenant }: { tenant: TenantListItem }) {
  // Falls back to ?tenant= on this origin when the deployment has no domain
  // under NEXT_PUBLIC_BASE_DOMAIN yet — see tenantHref().
  const home = tenantHref(tenant.subdomain);
  const console_ = tenantHref(tenant.subdomain, `/app/admin/tenants/${tenant.id}`);

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <Building2 className="h-5 w-5 shrink-0 text-muted-foreground" />

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">
            {tenant.name_he || tenant.name}
          </p>
          <a href={home} dir="ltr" className="truncate text-sm text-muted-foreground hover:underline">
            {/* The canonical address, even when the link itself routes via
                ?tenant= — this is the name, not the route. */}
            {tenant.subdomain}.{BASE_DOMAIN}
          </a>
        </div>

        <Badge variant={tenant.status === 'active' ? 'secondary' : 'outline'}>
          {STATUS_LABELS[tenant.status]}
        </Badge>
        <Badge variant="outline">{PLAN_LABELS[tenant.plan_type]}</Badge>

        {/* The per-tenant console still lives inside the tenant — this is the
            door to it, not a second copy of it. */}
        <Button asChild size="sm" variant="outline">
          <a href={console_}>ניהול</a>
        </Button>
      </CardContent>
    </Card>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center p-4">
      {children}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.29 9.14 4.75 12 4.75Z"
      />
    </svg>
  );
}
