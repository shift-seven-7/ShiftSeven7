'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, MessageSquare, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { FormField } from '@/components/ui/form-field';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useShift7SystemConfig, useUpsertShift7SystemConfig } from '@/hooks/queries/useShift7SystemConfig';
import { useShift7Facilities } from '@/hooks/queries/useShift7Facilities';
import {
  useCreateShift7Facility,
  useDeleteShift7Facility,
  useUpdateShift7Facility,
} from '@/hooks/queries/useShift7FacilitiesAdmin';
import type { FacilityRow, Shift7ConfigCategory } from '@/types/database.types';

const DEFAULT_CONFIGS: { key: string; value: string; description: string; category: Shift7ConfigCategory }[] = [
  { key: 'max_shift_hours', value: '12', description: 'מקסימום שעות למשמרת בודדת', category: 'shift_limits' },
  { key: 'max_weekly_hours', value: '60', description: 'מקסימום שעות שבועיות לעובד', category: 'shift_limits' },
  { key: 'min_rest_hours', value: '8', description: 'מנוחה מינימלית בין משמרות (מגבלה קשיחה)', category: 'shift_limits' },
  { key: 'emergency_mode', value: 'false', description: 'מצב חירום (עקיפת מגבלות בזמן מלחמה)', category: 'emergency' },
  { key: 'slack_notification_channel', value: '', description: 'ערוץ Slack להתראות פרסום סידור', category: 'emergency' },
];

export default function Shift7SettingsPage() {
  const { data: configs = [] } = useShift7SystemConfig();
  const { data: facilities = [] } = useShift7Facilities();
  const upsertConfig = useUpsertShift7SystemConfig();
  const createFacility = useCreateShift7Facility();
  const updateFacility = useUpdateShift7Facility();
  const deleteFacility = useDeleteShift7Facility();

  const [local, setLocal] = useState<Record<string, string>>({});
  const [facilityDialogOpen, setFacilityDialogOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<FacilityRow | null>(null);
  const [facilityForm, setFacilityForm] = useState({ name: '', code: '', address: '' });

  useEffect(() => {
    const map: Record<string, string> = {};
    for (const cfg of configs) map[cfg.key] = cfg.value;
    for (const d of DEFAULT_CONFIGS) if (!(d.key in map)) map[d.key] = d.value;
    setLocal(map);
  }, [configs]);

  useEffect(() => {
    if (!facilityDialogOpen) return;
    setFacilityForm(
      editingFacility
        ? { name: editingFacility.name, code: editingFacility.code, address: editingFacility.address ?? '' }
        : { name: '', code: '', address: '' }
    );
  }, [facilityDialogOpen, editingFacility]);

  function descriptionFor(key: string) {
    return configs.find((c) => c.key === key)?.description ?? DEFAULT_CONFIGS.find((d) => d.key === key)?.description ?? key;
  }
  function categoryFor(key: string): Shift7ConfigCategory {
    return configs.find((c) => c.key === key)?.category ?? DEFAULT_CONFIGS.find((d) => d.key === key)?.category ?? 'emergency';
  }

  async function saveConfig(key: string) {
    try {
      await upsertConfig.mutateAsync({
        key,
        value: local[key] ?? '',
        description: descriptionFor(key),
        category: categoryFor(key),
      });
      toast.success(`עודכן ${descriptionFor(key)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בשמירה');
    }
  }

  const emergencyMode = local.emergency_mode === 'true';

  async function toggleEmergency(next: boolean) {
    setLocal((prev) => ({ ...prev, emergency_mode: next ? 'true' : 'false' }));
    try {
      await upsertConfig.mutateAsync({
        key: 'emergency_mode',
        value: next ? 'true' : 'false',
        description: descriptionFor('emergency_mode'),
        category: 'emergency',
      });
      toast.success(next ? 'מצב חירום הופעל' : 'מצב חירום בוטל');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בשמירה');
    }
  }

  async function handleSaveFacility() {
    try {
      if (editingFacility) {
        await updateFacility.mutateAsync({ id: editingFacility.id, ...facilityForm });
        toast.success('מתקן עודכן');
      } else {
        await createFacility.mutateAsync({ ...facilityForm, status: 'active' });
        toast.success('מתקן נוצר בהצלחה');
      }
      setFacilityDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בשמירה');
    }
  }

  async function handleDeleteFacility(id: string) {
    try {
      await deleteFacility.mutateAsync(id);
      toast.success('מתקן הוסר בהצלחה');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה במחיקה');
    }
  }

  return (
    <PageLayout title="הגדרות Shift7" subtitle="מגבלות מערכת, כללי איוש ומתקנים">
      <Card className={emergencyMode ? 'mb-6 border-destructive bg-destructive/5' : 'mb-6'}>
        <CardContent className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <AlertTriangle className={emergencyMode ? 'h-5 w-5 text-destructive' : 'h-5 w-5 text-muted-foreground'} />
            <div>
              <h3 className="font-semibold">מצב חירום</h3>
              <p className="text-xs text-muted-foreground">כשפעיל, ניתן לעקוף מגבלות שעות. מנוחה של 8 שעות תמיד נאכפת.</p>
            </div>
          </div>
          <Switch checked={emergencyMode} onCheckedChange={toggleEmergency} />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">מגבלות משמרת</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {['max_shift_hours', 'max_weekly_hours', 'min_rest_hours'].map((key) => (
              <FormField key={key} icon={AlertTriangle} label={descriptionFor(key)}>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={local[key] ?? ''}
                    disabled={key === 'min_rest_hours'}
                    onChange={(e) => setLocal((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                  <Button variant="outline" size="icon" disabled={key === 'min_rest_hours'} onClick={() => saveConfig(key)}>
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </FormField>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="p-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <MessageSquare className="h-4 w-4" /> התראות Slack
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">כשמפרסמים סידור עבודה, תישלח הודעה אוטומטית לערוץ זה</p>
          <div className="flex gap-2">
            <Input
              value={local.slack_notification_channel ?? ''}
              placeholder="#schedules"
              onChange={(e) => setLocal((prev) => ({ ...prev, slack_notification_channel: e.target.value }))}
            />
            <Button variant="outline" size="icon" onClick={() => saveConfig('slack_notification_channel')}>
              <Save className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">מתקנים</h3>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setEditingFacility(null);
                setFacilityDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> הוסף מתקן
            </Button>
          </div>
          {facilities.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">אין מתקנים. הוסף את המתקן הראשון כדי להתחיל.</p>
          ) : (
            <div className="space-y-2">
              {facilities.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <div>
                    <span className="text-sm font-medium">{f.name}</span>
                    <Badge variant="outline" className="ms-2 text-xs">
                      {f.code}
                    </Badge>
                    {f.address && <span className="ms-2 text-xs text-muted-foreground">{f.address}</span>}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="עריכה"
                      onClick={() => {
                        setEditingFacility(f);
                        setFacilityDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      aria-label="מחיקה"
                      onClick={() => handleDeleteFacility(f.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={facilityDialogOpen} onOpenChange={setFacilityDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingFacility ? 'עריכת מתקן' : 'הוספת מתקן'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <FormField icon={Plus} label="שם" required>
              <Input value={facilityForm.name} onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })} />
            </FormField>
            <FormField icon={Plus} label="קוד" required hint="לדוגמה: KR">
              <Input value={facilityForm.code} onChange={(e) => setFacilityForm({ ...facilityForm, code: e.target.value })} />
            </FormField>
            <FormField icon={Plus} label="כתובת">
              <Input value={facilityForm.address} onChange={(e) => setFacilityForm({ ...facilityForm, address: e.target.value })} />
            </FormField>
          </div>
          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button
              onClick={handleSaveFacility}
              disabled={!facilityForm.name || !facilityForm.code || createFacility.isPending || updateFacility.isPending}
            >
              {editingFacility ? 'עדכן' : 'צור'} מתקן
            </Button>
            <Button variant="outline" onClick={() => setFacilityDialogOpen(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
