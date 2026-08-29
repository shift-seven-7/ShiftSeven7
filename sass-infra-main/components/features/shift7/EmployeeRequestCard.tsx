'use client';

import { useState } from 'react';
import { CheckCircle2, FileText, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { REQUEST_TYPES, STATUS_META, dateRangeText } from '@/lib/shift7/employeeRequests';
import type { EmployeeRequestRow } from '@/types/database.types';

interface EmployeeRequestCardProps {
  request: EmployeeRequestRow;
  /** Show the requester's name and the approve/reject controls. */
  admin?: boolean;
  actioning: boolean;
  onDecide?: (request: EmployeeRequestRow, status: 'approved' | 'rejected', comment: string) => void;
}

export function EmployeeRequestCard({ request, admin, actioning, onDecide }: EmployeeRequestCardProps) {
  const meta = REQUEST_TYPES[request.type];
  const Icon = meta?.icon ?? FileText;
  const [comment, setComment] = useState(request.manager_comment ?? '');
  const statusMeta = STATUS_META[request.status];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', meta?.color ?? 'bg-muted')}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            {admin && <p className="truncate text-sm font-semibold">{request.staff_name}</p>}
            <p className="text-sm font-medium">{meta?.label ?? request.type}</p>
            {dateRangeText(request) && (
              <p className="mt-0.5 text-xs text-muted-foreground">{dateRangeText(request)}</p>
            )}
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold',
            statusMeta.color
          )}
        >
          {statusMeta.label}
        </span>
      </div>

      {request.notes && (
        <p className="mt-3 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">{request.notes}</p>
      )}

      {admin && request.status === 'pending' && onDecide && (
        <div className="mt-3 border-t border-border pt-3">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="תגובת מנהל (אופציונלי)..."
            rows={2}
            className="text-xs"
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={() => onDecide(request, 'approved', comment)}
              disabled={actioning}
              className="gap-1.5 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> אשר
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDecide(request, 'rejected', comment)}
              disabled={actioning}
              className="gap-1.5 text-red-600 hover:bg-red-50"
            >
              <XCircle className="h-3.5 w-3.5" /> דחה
            </Button>
          </div>
        </div>
      )}

      {admin && request.status !== 'pending' && request.manager_comment && (
        <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          <span className="font-medium">תגובת מנהל: </span>
          {request.manager_comment}
        </div>
      )}
    </div>
  );
}
