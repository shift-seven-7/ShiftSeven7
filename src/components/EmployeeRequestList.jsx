import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { REQUEST_TYPES, STATUS_META, dateRangeText } from "@/lib/employeeRequests";
import { Paperclip, CheckCircle2, XCircle, FileText, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function StatusBadge({ status }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap", m.color)}>
      {m.label}
    </span>
  );
}

function RequestCard({ req, admin, actioning, onAction }) {
  const meta = REQUEST_TYPES[req.type];
  const Icon = meta?.icon || FileText;
  const [comment, setComment] = useState(req.manager_comment || "");

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", meta?.color || "bg-muted")}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            {admin && <p className="text-sm font-semibold truncate">{req.staff_name}</p>}
            <p className="text-sm font-medium">{meta?.label || req.type}</p>
            {dateRangeText(req) && (
              <p className="text-xs text-muted-foreground mt-0.5">📅 {dateRangeText(req)}</p>
            )}
          </div>
        </div>
        <StatusBadge status={req.status} />
      </div>

      {(req.notes || req.file_url) && (
        <div className="mt-3 space-y-1.5">
          {req.notes && (
            <p className="text-muted-foreground bg-muted/40 rounded-md px-2.5 py-1.5 text-xs">{req.notes}</p>
          )}
          {req.file_url && (
            <a
              href={req.file_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Paperclip className="w-3.5 h-3.5" />
              {req.file_name || "צפה בקובץ"}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {admin && req.status === "pending" && (
        <div className="mt-3 border-t border-border pt-3">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="תגובת מנהל (אופציונלי)..."
            rows={2}
            className="text-xs"
          />
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              onClick={() => onAction(req, "approved", comment)}
              disabled={actioning}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> אשר
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction(req, "rejected", comment)}
              disabled={actioning}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <XCircle className="w-3.5 h-3.5" /> דחה
            </Button>
          </div>
        </div>
      )}

      {admin && req.status !== "pending" && req.manager_comment && (
        <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          <span className="font-medium">תגובת מנהל: </span>
          {req.manager_comment}
          {req.handled_by && <span className="opacity-60"> · {req.handled_by}</span>}
        </div>
      )}
    </div>
  );
}

export default function EmployeeRequestList({ requests, admin, onAction: parentAction }) {
  const [actioning, setActioning] = useState(null);
  const qc = useQueryClient();

  const handleAction = async (req, status, comment) => {
    setActioning(req.id);
    try {
      const user = await base44.auth.me();
      await base44.entities.EmployeeRequest.update(req.id, {
        status,
        manager_comment: comment || undefined,
        handled_by: user?.full_name || "מנהל",
      });

      // On approval of an absence request (vacation / sick / reserve), cancel the
      // employee's existing shift assignments within the approved date range so the
      // schedule board reflects the absence immediately.
      if (status === "approved" && req.start_date) {
        const end = req.end_date || req.start_date;
        const meta = REQUEST_TYPES[req.type];
        try {
          const conflicting = await base44.entities.ShiftAssignment.filter({
            staff_id: req.staff_id,
            date: { $gte: req.start_date, $lte: end },
          });
          const toCancel = conflicting.filter((a) => a.status !== "cancelled");
          if (toCancel.length > 0) {
            await base44.entities.ShiftAssignment.bulkUpdate(
              toCancel.map((a) => ({
                id: a.id,
                status: "cancelled",
                is_emergency_override: true,
                override_reason: `בקשה שאושרה: ${meta?.label || req.type}`,
              }))
            );
            toast.success(`${toCancel.length} משמרות בוטלו בלוח המשמרות`);
            qc.invalidateQueries({
              predicate: (q) =>
                (q.queryKey || []).some(
                  (k) =>
                    typeof k === "string" &&
                    /assignment|gap|schedule|published/i.test(k)
                ),
            });
          }
        } catch (e) {
          /* assignment cancellation failure shouldn't block the approval */
        }
      }

      toast.success(status === "approved" ? "הבקשה אושרה" : "הבקשה נדחתה");
      parentAction?.();
    } catch (e) {
      toast.error("שגיאה בעדכון הבקשה");
    } finally {
      setActioning(null);
    }
  };

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="w-8 h-8 text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">אין בקשות להצגה</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {requests.map((req) => (
        <RequestCard
          key={req.id}
          req={req}
          admin={admin}
          actioning={actioning === req.id}
          onAction={handleAction}
        />
      ))}
    </div>
  );
}