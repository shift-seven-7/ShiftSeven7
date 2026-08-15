"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateWeeklyHours, getWeekBounds, validateRestPeriod, validateRolePostMatch } from "@/lib/shiftValidation";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function AssignmentDialog({
  open,
  onOpenChange,
  defaultDate,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
  onCreated?: () => void;
}) {
  const [staffId, setStaffId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [postId, setPostId] = useState("");
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split("T")[0]);
  const [isEmergency, setIsEmergency] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Sync the date field whenever the parent opens this dialog with a new
    // defaultDate (e.g. clicking "assign" for a different day).
    if (defaultDate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDate(defaultDate);
    }
  }, [defaultDate]);

  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("staff").select("*");
      if (error) throw error;
      return data;
    },
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("shift_templates").select("*");
      if (error) throw error;
      return data;
    },
  });
  const { data: posts = [] } = useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("posts").select("*");
      if (error) throw error;
      return data;
    },
  });
  const { data: configs = [] } = useQuery({
    queryKey: ["configs"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("system_config").select("*");
      if (error) throw error;
      return data;
    },
  });

  const activeStaff = staff.filter((s) => s.status === "active");
  const selectedStaff = activeStaff.find((s) => s.id === staffId);
  const selectedTemplate = templates.find((t) => t.id === templateId);
  const selectedPost = posts.find((p) => p.id === postId);

  const availableTemplates = selectedStaff
    ? templates.filter((t) => (t.applicable_roles || []).includes(selectedStaff.role))
    : templates;
  const availablePosts = selectedStaff
    ? posts.filter((p) => p.required_role === selectedStaff.role && p.status === "active")
    : posts.filter((p) => p.status === "active");

  const maxShiftHours = parseFloat(configs.find((c) => c.key === "max_shift_hours")?.value || "12");
  const maxWeeklyHours = parseFloat(configs.find((c) => c.key === "max_weekly_hours")?.value || "60");

  const computeTimes = () => {
    if (!selectedTemplate || !date) return { start: null, end: null };
    const start = new Date(`${date}T${selectedTemplate.start_time}`);
    const end = new Date(`${date}T${selectedTemplate.end_time}`);
    if (end <= start) end.setDate(end.getDate() + 1);
    return { start, end };
  };

  const validate = async (): Promise<string[]> => {
    const errors: string[] = [];
    if (!staffId || !templateId || !postId || !date) return errors;

    const { start, end } = computeTimes();
    if (!start || !end) return errors;

    if (selectedStaff && selectedPost) {
      const roleCheck = validateRolePostMatch(selectedStaff.role, selectedPost.type);
      if (!roleCheck.valid && roleCheck.error) errors.push(roleCheck.error);
    }

    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (durationHours > maxShiftHours && !isEmergency) {
      errors.push(`Shift is ${durationHours}h, exceeding the ${maxShiftHours}h maximum. Enable emergency override to proceed.`);
    }

    const supabase = createClient();
    const { data: existingAssignments = [] } = await supabase
      .from("shift_assignments")
      .select("*")
      .eq("staff_id", staffId);

    const restCheck = validateRestPeriod(start.toISOString(), end.toISOString(), existingAssignments || []);
    if (!restCheck.valid && restCheck.error) errors.push(restCheck.error);

    const { weekStart, weekEnd } = getWeekBounds(date);
    const weekAssignments = (existingAssignments || []).filter((a) => {
      const aDate = new Date(a.date);
      return aDate >= weekStart && aDate <= weekEnd && a.status !== "cancelled";
    });
    const currentWeeklyHours = calculateWeeklyHours(weekAssignments);
    if (currentWeeklyHours + durationHours > maxWeeklyHours && !isEmergency) {
      errors.push(
        `Would exceed weekly limit: ${(currentWeeklyHours + durationHours).toFixed(1)}h / ${maxWeeklyHours}h. Enable emergency override to proceed.`,
      );
    }

    return errors;
  };

  const handleSave = async () => {
    setSaving(true);
    const errors = await validate();

    const restErrors = errors.filter((e) => e.includes("rest") || e.includes("Overlap") || e.includes("מנוחה") || e.includes("חפיפה"));
    if (restErrors.length > 0) {
      setValidationErrors(restErrors);
      setSaving(false);
      return;
    }

    const nonRestErrors = errors.filter((e) => !restErrors.includes(e));
    if (nonRestErrors.length > 0 && !isEmergency) {
      setValidationErrors(nonRestErrors);
      setSaving(false);
      return;
    }

    const { start, end } = computeTimes();
    if (!start || !end || !selectedPost) {
      setSaving(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from("shift_assignments").insert({
      staff_id: staffId,
      staff_name: selectedStaff?.full_name || "",
      shift_template_id: templateId,
      shift_code: selectedTemplate?.code || "",
      post_id: postId,
      post_name: selectedPost.name,
      facility_id: selectedPost.facility,
      date,
      actual_start: start.toISOString(),
      actual_end: end.toISOString(),
      status: "scheduled",
      is_emergency_override: isEmergency,
      override_reason: isEmergency ? overrideReason : null,
    });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("משמרת שובצה בהצלחה");
    setValidationErrors([]);
    resetForm();
    onCreated?.();
  };

  const resetForm = () => {
    setStaffId("");
    setTemplateId("");
    setPostId("");
    setIsEmergency(false);
    setOverrideReason("");
    setValidationErrors([]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>שיבוץ משמרת</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>תאריך</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>איש צוות</Label>
            <Select
              value={staffId}
              onValueChange={(v) => {
                setStaffId(v);
                setTemplateId("");
                setPostId("");
                setValidationErrors([]);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר עובד..." />
              </SelectTrigger>
              <SelectContent>
                {activeStaff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name} — {s.role === "guard" ? "מאבטח" : "מוקדן"}
                    {s.qualification !== "none" ? ` (אחמ"ש)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>תבנית משמרת</Label>
              <Select
                value={templateId}
                onValueChange={(v) => {
                  setTemplateId(v);
                  setValidationErrors([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.code} — {t.name} ({t.start_time}–{t.end_time})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>עמדה</Label>
              <Select
                value={postId}
                onValueChange={(v) => {
                  setPostId(v);
                  setValidationErrors([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר..." />
                </SelectTrigger>
                <SelectContent>
                  {availablePosts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.type === "control_room" ? "חדר מוקד" : "עמדה סטטית"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {validationErrors.length > 0 && (
            <div className="space-y-2">
              {validationErrors.map((err, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          <div className="p-4 rounded-lg border border-amber-200 bg-amber-50">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={isEmergency} onCheckedChange={(v) => setIsEmergency(!!v)} />
              חריגה חירומית
            </label>
            <p className="text-xs text-muted-foreground mt-1 mr-6">
              מעקף הגבלות שעות משמרת/שבועי. כלל ה-8 שעות מנוחה תמיד נאכף.
            </p>
            {isEmergency && (
              <Input
                className="mt-2 mr-6"
                placeholder="סיבה לחריגה..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            )}
          </div>

          <Button className="w-full" onClick={handleSave} disabled={!staffId || !templateId || !postId || !date || saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
            שבץ משמרת
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
