'use client';

import { useEffect, useState } from 'react';
import { Building2, Globe, HardDrive, KeyRound, Shield, Tag, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FormField } from '@/components/ui/form-field';
import { Segmented } from '@/components/ui/segmented';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUpdateTenant } from '@/hooks/queries/useTenants';
import { PLAN_LABELS, STATUS_LABELS } from '@/types/tenant.types';
import type { TenantPlan } from '@/types/tenant.types';
import type { TenantPublic } from '@/lib/tenant/serialize';
import { BASE_DOMAIN } from '@/lib/constants/domain';

/**
 * Identity, plan, and Supabase connection for one tenant.
 *
 * The key fields are WRITE-ONLY: the server never sends a key back, so they
 * render empty and an empty submission means "leave the stored key alone".
 * That is why there is no reveal/copy affordance here — the browser genuinely
 * does not have the value.
 */
export function TenantDetailsTab({ tenant }: { tenant: TenantPublic }) {
  const update = useUpdateTenant();

  const [name, setName] = useState('');
  const [nameHe, setNameHe] = useState('');
  const [plan, setPlan] = useState<TenantPlan>('standard');
  const [maxUsers, setMaxUsers] = useState('0');
  const [storageGb, setStorageGb] = useState('0');
  const [anonKey, setAnonKey] = useState('');
  const [serviceKey, setServiceKey] = useState('');

  useEffect(() => {
    setName(tenant.name);
    setNameHe(tenant.name_he ?? '');
    setPlan(tenant.plan_type);
    setMaxUsers(String(tenant.max_users));
    setStorageGb(String(tenant.storage_limit_gb));
    setAnonKey('');
    setServiceKey('');
  }, [tenant]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();

    try {
      await update.mutateAsync({
        id: tenant.id,
        name,
        name_he: nameHe || null,
        plan_type: plan,
        max_users: Number(maxUsers) || 0,
        storage_limit_gb: Number(storageGb) || 0,
        // Empty means unchanged — see the note above.
        supabase_anon_key: anonKey || undefined,
        supabase_service_role_key: serviceKey || undefined,
      });

      setAnonKey('');
      setServiceKey('');
      toast.success('הטננט עודכן');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'עדכון הטננט נכשל');
    }
  }

  async function handleStatusToggle() {
    const action = tenant.status === 'suspended' ? 'reactivate' : 'suspend';

    try {
      await update.mutateAsync({ id: tenant.id, action });
      toast.success(action === 'suspend' ? 'הטננט הושהה' : 'הטננט הופעל מחדש');
    } catch {
      toast.error('שינוי הסטטוס נכשל');
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">פרטי הארגון</CardTitle>
            <CardDescription dir="ltr">
              {tenant.subdomain}.{BASE_DOMAIN}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={tenant.status === 'active' ? 'default' : 'outline'}>
              {STATUS_LABELS[tenant.status]}
            </Badge>
            <Button type="button" variant="outline" size="sm" onClick={handleStatusToggle}>
              {tenant.status === 'suspended' ? 'הפעלה מחדש' : 'השהיה'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="שם (אנגלית)" icon={Building2} required>
            <Input
              dir="ltr"
              className="text-start"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>

          <FormField label="שם בעברית" icon={Building2}>
            <Input value={nameHe} onChange={(event) => setNameHe(event.target.value)} />
          </FormField>

          <FormField
            label="סאב-דומיין"
            icon={Globe}
            hint="לא ניתן לשינוי — כתובות ה-DNS וההצפנה קשורות אליו"
          >
            <Input dir="ltr" className="text-start" value={tenant.subdomain} disabled />
          </FormField>

          <FormField label="מנוי" icon={Tag} required>
            <Segmented
              options={(Object.keys(PLAN_LABELS) as TenantPlan[]).map((value) => ({
                value,
                label: PLAN_LABELS[value],
              }))}
              value={plan}
              onChange={setPlan}
            />
          </FormField>

          <FormField label="מקסימום משתמשים" icon={Users}>
            <Input
              type="number"
              min={0}
              dir="ltr"
              className="text-start"
              value={maxUsers}
              onChange={(event) => setMaxUsers(event.target.value)}
            />
          </FormField>

          <FormField label="נפח אחסון (GB)" icon={HardDrive}>
            <Input
              type="number"
              min={0}
              dir="ltr"
              className="text-start"
              value={storageGb}
              onChange={(event) => setStorageGb(event.target.value)}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">חיבור ל-Supabase</CardTitle>
          <CardDescription>
            המפתחות נשמרים מוצפנים ולא נשלחים לדפדפן. השאר ריק כדי לא לשנות.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Project Ref" icon={Building2}>
            <Input
              dir="ltr"
              className="text-start"
              value={tenant.supabase_project_ref}
              disabled
            />
          </FormField>

          <FormField label="Project URL" icon={Globe}>
            <Input dir="ltr" className="text-start" value={tenant.supabase_url} disabled />
          </FormField>

          <FormField
            label="Publishable / anon key"
            icon={KeyRound}
            hint={`נשמר: ${tenant.supabase_anon_key_masked || '—'}`}
          >
            <Input
              type="password"
              dir="ltr"
              className="text-start"
              placeholder="מפתח חדש (אופציונלי)"
              value={anonKey}
              onChange={(event) => setAnonKey(event.target.value.trim())}
            />
          </FormField>

          <FormField
            label="Service role key"
            icon={Shield}
            hint={tenant.has_service_role_key ? 'מפתח שמור' : 'לא הוגדר מפתח'}
          >
            <Input
              type="password"
              dir="ltr"
              className="text-start"
              placeholder="מפתח חדש (אופציונלי)"
              value={serviceKey}
              onChange={(event) => setServiceKey(event.target.value.trim())}
            />
          </FormField>
        </CardContent>
      </Card>

      <div className="flex flex-row-reverse">
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'שומר...' : 'שמירה'}
        </Button>
      </div>
    </form>
  );
}
