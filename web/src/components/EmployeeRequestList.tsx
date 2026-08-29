"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { REQUEST_TYPES, STATUS_META, dateRangeText, type RequestStatus, type RequestType } from "@/lib/employeeRequests";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/database.types";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, FileText, Paperclip, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ATTACHMENTS_BUCKET = "employee-request-attachments";

type EmployeeRequest = Database["public"]["Tables"]["employee_requests"]["Row"];

function StatusBadge({ status }: { status: RequestStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap", m.color)}>
      {m.label}
    </span>
  );
}

async function openAttachment(path: string) {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(path, 60);
  if (error || !data) {
    toast.error("שגיאה בפתיחת הקובץ");
    return;
  }
  window.open(data.signedUrl, "_blank", "noreferrer");
}

function RequestCard({
  req,
  admin,
  actioning,
  onAction,
}: {
  req: EmployeeRequest;
  admin?: boolean;
  actioning: boolean;
  onAction: (req: EmployeeRequest, status: "approved" | "rejected", comment: string) => void;
}) {
  const meta = REQUEST_TYPES[req.type as RequestType];
  const Icon = meta?.icon || FileText;
  const [comment, setComment] = useState(req.manager_comment || "");

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", meta?.color || "bg-muted")}
          >
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            {admin && <p className="text-sm font-semibold truncate">{req.staff_name}</p>}
            <p className="text-sm font-medium">{meta?.label || req.type}</p>
            {dateRangeText(req) && <p className="text-xs text-muted-foreground mt-0.5">📅 {dateRangeText(req)}</p>}
          </div>
        </div>
        <StatusBadge status={req.status as RequestStatus} />
      </div>

      {(req.notes || req.file_url) && (
        <div className="mt-3 space-y-1.5">
          {req.notes && <p className="text-muted-foreground bg-muted/40 rounded-md px-2.5 py-1.5 text-xs">{req.notes}</p>}
          {req.file_url && (
            <button
              onClick={() => openAttachment(req.file_url!)}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Paperclip className="w-3.5 h-3.5" />
              {req.file_name || "צפה בקובץ"}
              <ExternalLink className="w-3 h-3" />
            </button>
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
        </div>
      )}
    </div>
  );
}

export default function EmployeeRequestList({
  requests,
  admin,
  onAction: parentAction,
}: {
  requests: EmployeeRequest[];
  admin?: boolean;
  onAction?: () => void;
}) {
  const [actioning, setActioning] = useState<string | null>(null);
  const qc = useQueryClient();

  const handleAction = async (req: EmployeeRequest, status: "approved" | "rejected", comment: string) => {
    setActioning(req.id);
    try {
      const supabase = createClient();
      const { data: claims } = await supabase.auth.getClaims();

      const { error: updateError } = await supabase
        .from("employee_requests")
        .update({
          status,
          manager_comment: comment || null,
          handled_by: claims?.claims?.sub ?? null,
        })
        .eq("id", req.id);
      if (updateError) throw updateError;

      // On approval of an absence request, cancel the employee's existing shift
      // assignments within the approved date range so the schedule board reflects
      // the absence immediately - matches the old app's behavior.
      if (status === "approved" && req.start_date) {
        const end = req.end_date || req.start_date;
        const meta = REQUEST_TYPES[req.type as RequestType];
        try {
          const { data: conflicting } = await supabase
            .from("shift_assignments")
            .select("id")
            .eq("staff_id", req.staff_id)
            .gte("date", req.start_date)
            .lte("date", end)
            .neq("status", "cancelled");
          const ids = (conflicting || []).map((a) => a.id);
          if (ids.length > 0) {
            await supabase
              .from("shift_assignments")
              .update({
                status: "cancelled",
                is_emergency_override: true,
                override_reason: `בקשה שאושרה: ${meta?.label || req.type}`,
              })
              .in("id", ids);
            toast.success(`${ids.length} משמרות בוטלו בלוח המשמרות`);
            qc.invalidateQueries({
              predicate: (q) =>
                q.queryKey.some((k) => typeof k === "string" && /assignment|gap|schedule|published/i.test(k)),
            });
          }
        } catch {
          // assignment cancellation failure shouldn't block the approval
        }
      }

      toast.success(status === "approved" ? "הבקשה אושרה" : "הבקשה נדחתה");
      parentAction?.();
    } catch {
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
        <RequestCard key={req.id} req={req} admin={admin} actioning={actioning === req.id} onAction={handleAction} />
      ))}
    </div>
  );
}
