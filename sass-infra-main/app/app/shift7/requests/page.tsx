'use client';

import { useState } from 'react';
import { FileText, Loader2, Paperclip, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { DateInput } from '@/components/ui/date-input';
import { EmployeeRequestCard } from '@/components/features/shift7/EmployeeRequestCard';
import { REQUEST_TYPES } from '@/lib/shift7/employeeRequests';
import { useCreateShift7EmployeeRequest, useMyShift7EmployeeRequests } from '@/hooks/queries/useShift7EmployeeRequests';
import { useMyShift7Staff } from '@/hooks/queries/useMyShift7Staff';
import { cn } from '@/lib/utils';
import type { Shift7EmployeeRequestType } from '@/types/database.types';

export default function Shift7RequestsPage() {
  const { data: myStaff } = useMyShift7Staff();
  const { data: requests = [], isPending } = useMyShift7EmployeeRequests();
  const create = useCreateShift7EmployeeRequest();

  const [type, setType] = useState<Shift7EmployeeRequestType | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const meta = type ? REQUEST_TYPES[type] : null;

  function reset() {
    setType('');
    setStartDate('');
    setEndDate('');
    setNotes('');
    setFile(null);
  }

  async function handleSubmit() {
    if (!type || !meta) {
      toast.error('יש לבחור סוג בקשה');
      return;
    }
    if (meta.dates === 'required' && (!startDate || !endDate)) {
      toast.error('יש למלא תאריך התחלה וסיום');
      return;
    }

    setUploading(true);
    try {
      const result = await create.mutateAsync({
        type,
        start_date: startDate || null,
        end_date: endDate || null,
        notes: notes || null,
      });

      if (file) {
        const form = new FormData();
        form.append('file', file);
        form.append('bucket', 'documents');
        form.append('entityType', 'employee_request');
        form.append('entityId', result.employeeRequest.id);
        const uploadResponse = await fetch('/api/files/upload', { method: 'POST', body: form });
        if (!uploadResponse.ok) toast.error('הבקשה נשלחה, אך העלאת הקובץ נכשלה');
      }

      toast.success('הבקשה נשלחה בהצלחה');
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בשליחת הבקשה');
    } finally {
      setUploading(false);
    }
  }

  return (
    <PageLayout title="הבקשות שלי" subtitle="הגשת בקשות חופשה, מילואים, מחלה ועוד — ומעקב אחר סטטוס">
      {!myStaff ? (
        <p className="py-16 text-center text-sm text-muted-foreground">אין לך רשומת עובד משויכת במערכת. פנה למנהל המערכת.</p>
      ) : (
        <div className="grid gap-6">
          <Card>
            <CardContent className="p-5">
              <h2 className="mb-4 text-sm font-semibold">הגשת בקשה חדשה</h2>

              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(Object.entries(REQUEST_TYPES) as [Shift7EmployeeRequestType, (typeof REQUEST_TYPES)[Shift7EmployeeRequestType]][]).map(
                  ([key, m]) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setType(key)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all',
                          type === key ? `${m.color} ring-2 ring-primary/30` : 'border-border bg-card hover:bg-muted'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {m.label}
                      </button>
                    );
                  }
                )}
              </div>

              {meta && (
                <div className="space-y-4">
                  {meta.dates !== 'none' && (
                    <div className="grid grid-cols-2 gap-3">
                      <FormField icon={FileText} label="תאריך התחלה" required={meta.dates === 'required'}>
                        <DateInput value={startDate} onChange={setStartDate} />
                      </FormField>
                      <FormField icon={FileText} label="תאריך סיום" required={meta.dates === 'required'}>
                        <DateInput value={endDate} onChange={setEndDate} />
                      </FormField>
                    </div>
                  )}

                  <FormField icon={Paperclip} label="צרף קובץ" hint="אופציונלי — PDF או תמונה">
                    {file ? (
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-3">
                        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate text-sm">{file.name}</span>
                        <button type="button" onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-4 text-sm text-muted-foreground transition-colors hover:bg-muted">
                        <Paperclip className="h-4 w-4" />
                        לחץ להעלאת קובץ
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,image/*"
                          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
                    )}
                  </FormField>

                  <FormField icon={FileText} label={meta.reason ? 'הערות / סיבה' : 'הערות (אופציונלי)'}>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={meta.reason ? 3 : 2} />
                  </FormField>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={reset} disabled={uploading}>
                      נקה
                    </Button>
                    <Button onClick={handleSubmit} disabled={uploading} className="gap-2">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {uploading ? 'שולח...' : 'שלח בקשה'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h2 className="mb-4 text-sm font-semibold">הבקשות שלי ({requests.length})</h2>
              {isPending ? (
                <p className="py-8 text-center text-sm text-muted-foreground">טוען...</p>
              ) : requests.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">אין בקשות להצגה</p>
              ) : (
                <div className="space-y-2.5">
                  {requests.map((r) => (
                    <EmployeeRequestCard key={r.id} request={r} actioning={false} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageLayout>
  );
}
