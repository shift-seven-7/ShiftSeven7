import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { REQUEST_TYPES } from "@/lib/employeeRequests";
import { Upload, Loader2, Send, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function EmployeeRequestForm({ staff, onSubmitted }) {
  const [type, setType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [file, setFile] = useState(null);
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
    if (!type) {
      toast.error("יש לבחור סוג בקשה");
      return;
    }
    if (meta?.dates === "required" && (!startDate || !endDate)) {
      toast.error("יש למלא תאריך התחלה וסיום");
      return;
    }
    if (meta?.file === "required" && !file) {
      toast.error("יש לצרף קובץ");
      return;
    }
    setSubmitting(true);
    try {
      let file_url = "";
      let file_name = "";
      if (file) {
        const res = await base44.integrations.Core.UploadFile({ file });
        file_url = res.file_url;
        file_name = file.name;
      }
      await base44.entities.EmployeeRequest.create({
        staff_id: staff.id,
        staff_name: staff.full_name,
        type,
        status: "pending",
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        file_url: file_url || undefined,
        file_name: file_name || undefined,
        notes: notes || undefined,
      });
      // Notify management via Slack (best-effort, doesn't block submission)
      try {
        const dateRange = startDate
          ? endDate && endDate !== startDate
            ? `${startDate} – ${endDate}`
            : startDate
          : "";
        await base44.functions.invoke("notifyEmployeeRequest", {
          staff_name: staff.full_name,
          type_label: meta.label,
          date_range: dateRange,
          notes: notes || "",
        });
      } catch (e) {
        /* notification failure shouldn't block submission */
      }
      toast.success("הבקשה נשלחה בהצלחה");
      reset();
      onSubmitted?.();
    } catch (e) {
      toast.error("שגיאה בשליחת הבקשה");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Type selector */}
      <div>
        <Label className="text-sm font-semibold mb-2 block">סוג הבקשה</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(REQUEST_TYPES).map(([key, m]) => {
            const Icon = m.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setType(key)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all",
                  type === key ? `${m.color} ring-2 ring-primary/30` : "bg-card border-border hover:bg-muted"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {m.label}
              </button>
            );
          })}
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

          {meta.file !== "none" && (
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
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                </label>
              )}
            </div>
          )}

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