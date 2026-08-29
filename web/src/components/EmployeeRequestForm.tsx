"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notifyEmployeeRequest } from "@/app/actions/notifications";
import { REQUEST_TYPES, type RequestType } from "@/lib/employeeRequests";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Loader2, Paperclip, Send, Upload, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ATTACHMENTS_BUCKET = "employee-request-attachments";

export default function EmployeeRequestForm({
  staff,
  onSubmitted,
}: {
  staff: { id: string; user_id: string | null; full_name: string };
  onSubmitted?: () => void;
}) {
  const [type, setType] = useState<RequestType | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const meta = type ? REQUEST_TYPES[type] : null;

  const reset = () => {
    setType("");
    setStartDate("");
    setEndDate("");
    setFile(null);
    setNotes("");
  };

  const handleSubmit = async () => {
    if (!type || !meta) {
      toast.error("יש לבחור סוג בקשה");
      return;
    }
    if (meta.dates === "required" && (!startDate || !endDate)) {
      toast.error("יש למלא תאריך התחלה וסיום");
      return;
    }
    if (meta.file === "required" && !file) {
      toast.error("יש לצרף קובץ");
      return;
    }
    if (!staff.user_id) {
      toast.error("לא נמצא חשבון מחובר לרשומת העובד שלך");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      let fileUrl: string | null = null;
      let fileName: string | null = null;

      if (file) {
        const path = `${staff.user_id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from(ATTACHMENTS_BUCKET)
          .upload(path, file);
        if (uploadError) throw uploadError;
        fileUrl = path;
        fileName = file.name;
      }

      const { error: insertError } = await supabase.from("employee_requests").insert({
        staff_id: staff.id,
        staff_name: staff.full_name,
        type,
        status: "pending",
        start_date: startDate || null,
        end_date: endDate || null,
        file_url: fileUrl,
        file_name: fileName,
        notes: notes || null,
      });
      if (insertError) throw insertError;

      const dateRange = startDate ? (endDate && endDate !== startDate ? `${startDate} – ${endDate}` : startDate) : "";
      // Best-effort - failures here shouldn't surface to the employee, the request already saved.
      notifyEmployeeRequest({
        staffName: staff.full_name,
        typeLabel: meta.label,
        dateRange,
        notes: notes || undefined,
      }).catch(() => {});

      toast.success("הבקשה נשלחה בהצלחה");
      reset();
      onSubmitted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשליחת הבקשה");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <Label className="text-sm font-semibold mb-2 block">סוג הבקשה</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(Object.entries(REQUEST_TYPES) as [RequestType, (typeof REQUEST_TYPES)[RequestType]][]).map(
            ([key, m]) => {
              const Icon = m.icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all",
                    type === key ? `${m.color} ring-2 ring-primary/30` : "bg-card border-border hover:bg-muted",
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {m.label}
                </button>
              );
            },
          )}
        </div>
      </div>

      {meta && (
        <>
          {meta.dates !== "none" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">
                  תאריך התחלה {meta.dates === "required" && <span className="text-red-500">*</span>}
                </Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">
                  תאריך סיום {meta.dates === "required" && <span className="text-red-500">*</span>}
                </Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium mb-1.5 block">
              צרף קובץ {meta.file === "required" && <span className="text-red-500">*</span>}
            </Label>
            {file ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
                <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1 truncate">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-border hover:bg-muted cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">לחץ להעלאת קובץ (PDF, תמונה)</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>

          <div>
            <Label className="text-sm font-medium mb-1.5 block">
              {meta.reason ? "הערות / סיבה" : "הערות (אופציונלי)"}
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={meta.reason ? "הוסף סיבה או הערה לבקשה..." : "הערה נוספת..."}
              rows={meta.reason ? 3 : 2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={reset} disabled={submitting}>
              נקה
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> שולח...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> שלח בקשה
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
