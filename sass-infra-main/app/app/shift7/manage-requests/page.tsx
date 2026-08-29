'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageLayout } from '@/components/layout/PageLayout';
import { PageTabs } from '@/components/ui/page-tabs';
import { EmployeeRequestCard } from '@/components/features/shift7/EmployeeRequestCard';
import { useAllShift7EmployeeRequests, useDecideShift7EmployeeRequest } from '@/hooks/queries/useShift7EmployeeRequests';
import type { EmployeeRequestRow, Shift7EmployeeRequestStatus } from '@/types/database.types';

type StatusFilter = Shift7EmployeeRequestStatus | 'all';

/** Admin/scheduler review — approve/reject. RLS + the API route restrict this to Shift7 admins/schedulers. */
export default function Shift7ManageRequestsPage() {
  const { data: requests = [], isPending } = useAllShift7EmployeeRequests();
  const decide = useDecideShift7EmployeeRequest();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [actioningId, setActioningId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    for (const r of requests) c[r.status]++;
    return c;
  }, [requests]);

  const filtered = statusFilter === 'all' ? requests : requests.filter((r) => r.status === statusFilter);

  async function handleDecide(request: EmployeeRequestRow, status: 'approved' | 'rejected', comment: string) {
    setActioningId(request.id);
    try {
      const result = await decide.mutateAsync({ id: request.id, status, managerComment: comment });
      toast.success(status === 'approved' ? 'הבקשה אושרה' : 'הבקשה נדחתה');
      if (result.cancelledAssignments > 0) {
        toast.info(`${result.cancelledAssignments} משמרות בוטלו בעקבות האישור`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בעדכון הבקשה');
    } finally {
      setActioningId(null);
    }
  }

  return (
    <PageLayout title="ניהול בקשות עובדים" subtitle="אישור ודחייה של בקשות חופשה, מילואים, מחלה ועוד">
      {counts.pending > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          {counts.pending} בקשות ממתינות לטיפולך
        </div>
      )}

      <PageTabs
        value={statusFilter}
        onChange={setStatusFilter}
        className="mb-4"
        ariaLabel="סטטוס בקשות"
        tabs={[
          { value: 'pending', label: `ממתינות (${counts.pending})` },
          { value: 'approved', label: `אושרו (${counts.approved})` },
          { value: 'rejected', label: `נדחו (${counts.rejected})` },
          { value: 'all', label: `הכל (${requests.length})` },
        ]}
      />

      {isPending ? (
        <p className="py-16 text-center text-sm text-muted-foreground">טוען...</p>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">אין בקשות להצגה</p>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((r) => (
            <EmployeeRequestCard key={r.id} request={r} admin actioning={actioningId === r.id} onDecide={handleDecide} />
          ))}
        </div>
      )}
    </PageLayout>
  );
}
