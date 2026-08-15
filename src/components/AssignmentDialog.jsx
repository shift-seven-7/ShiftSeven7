import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { validateRestPeriod, validateRolePostMatch, calculateWeeklyHours, getWeekBounds } from "../lib/shiftValidation";

export default function AssignmentDialog({ open, onOpenChange, defaultDate, onCreated }) {
  const [staffId, setStaffId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [postId, setPostId] = useState("");
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split("T")[0]);
  const [isEmergency, setIsEmergency] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [validationErrors, setValidationErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (defaultDate) setDate(defaultDate); }, [defaultDate]);

  const { data: staff = [] } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.Staff.list() });
  const { data: templates = [] } = useQuery({ queryKey: ["templates"], queryFn: () => base44.entities.ShiftTemplate.list() });
  const { data: posts = [] } = useQuery({ queryKey: ["posts"], queryFn: () => base44.entities.Post.list() });
  const { data: facilities = [] } = useQuery({ queryKey: ["facilities"], queryFn: () => base44.entities.Facility.list() });
  const { data: configs = [] } = useQuery({ queryKey: ["configs"], queryFn: () => base44.entities.SystemConfig.list() });

  const activeStaff = staff.filter(s => s.status === "active");
  const selectedStaff = activeStaff.find(s => s.id === staffId);
  const selectedTemplate = templates.find(t => t.id === templateId);
  const selectedPost = posts.find(p => p.id === postId);

  // Filter templates by staff role
  const availableTemplates = selectedStaff 
    ? templates.filter(t => (t.applicable_roles || []).includes(selectedStaff.role))
    : templates;

  // Filter posts by staff role
  const availablePosts = selectedStaff 
    ? posts.filter(p => p.required_role === selectedStaff.role && p.status === "active")
    : posts.filter(p => p.status === "active");

  // Get dynamic limits
  const maxShiftHours = parseFloat(configs.find(c => c.key === "max_shift_hours")?.value || "12");
  const maxWeeklyHours = parseFloat(configs.find(c => c.key === "max_weekly_hours")?.value || "60");

  const computeTimes = () => {
    if (!selectedTemplate || !date) return { start: null, end: null };
    const start = new Date(`${date}T${selectedTemplate.start_time}:00`);
    let end = new Date(`${date}T${selectedTemplate.end_time}:00`);
    if (end <= start) end.setDate(end.getDate() + 1); // overnight
    return { start, end };
  };

  const validate = async () => {
    const errors = [];
    if (!staffId || !templateId || !postId || !date) return errors;
    
    const { start, end } = computeTimes();
    if (!start || !end) return errors;

    // Role-post compatibility
    if (selectedStaff && selectedPost) {
      const roleCheck = validateRolePostMatch(selectedStaff.role, selectedPost.type);
      if (!roleCheck.valid) errors.push(roleCheck.error);
    }

    // Shift duration check
    const durationHours = (end - start) / (1000 * 60 * 60);
    if (durationHours > maxShiftHours && !isEmergency) {
      errors.push(`Shift is ${durationHours}h, exceeding the ${maxShiftHours}h maximum. Enable emergency override to proceed.`);
    }

    // 8-hour rest validation (the "trigger")
    const existingAssignments = await base44.entities.ShiftAssignment.filter({ staff_id: staffId });
    const restCheck = validateRestPeriod(start.toISOString(), end.toISOString(), existingAssignments);
    if (!restCheck.valid) {
      errors.push(restCheck.error);
    }

    // Weekly hours check
    const { weekStart, weekEnd } = getWeekBounds(date);
    const weekAssignments = existingAssignments.filter(a => {
      const aDate = new Date(a.date);
      return aDate >= weekStart && aDate <= weekEnd && a.status !== "cancelled";
    });
    const currentWeeklyHours = calculateWeeklyHours(weekAssignments);
    if (currentWeeklyHours + durationHours > maxWeeklyHours && !isEmergency) {
      errors.push(`Would exceed weekly limit: ${(currentWeeklyHours + durationHours).toFixed(1)}h / ${maxWeeklyHours}h. Enable emergency override to proceed.`);
    }

    return errors;
  };

  const handleSave = async () => {
    setSaving(true);
    const errors = await validate();
    
    // 8-hour rest is ALWAYS enforced (even with emergency override)
    const restErrors = errors.filter(e => e.includes("rest") || e.includes("Overlap"));
    if (restErrors.length > 0) {
      setValidationErrors(restErrors);
      setSaving(false);
      return;
    }

    // Other errors can be overridden with emergency flag
    const nonRestErrors = errors.filter(e => !e.includes("rest") && !e.includes("Overlap"));
    if (nonRestErrors.length > 0 && !isEmergency) {
      setValidationErrors(nonRestErrors);
      setSaving(false);
      return;
    }

    const { start, end } = computeTimes();
    const facilityId = selectedPost?.facility || "";

    await base44.entities.ShiftAssignment.create({
      staff_id: staffId,
      staff_name: selectedStaff?.full_name || "",
      shift_template_id: templateId,
      shift_code: selectedTemplate?.code || "",
      post_id: postId,
      post_name: selectedPost?.name || "",
      facility_id: facilityId,
      date,
      actual_start: start.toISOString(),
      actual_end: end.toISOString(),
      status: "scheduled",
      is_emergency_override: isEmergency,
      override_reason: isEmergency ? overrideReason : "",
      approved_by: ""
    });

    toast.success("משמרת שובצה בהצלחה");
    setSaving(false);
    setValidationErrors([]);
    resetForm();
    onCreated?.();
  };

  const resetForm = () => {
    setStaffId(""); setTemplateId(""); setPostId("");
    setIsEmergency(false); setOverrideReason(""); setValidationErrors([]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>שיבוץ משמרת</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>תאריך</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <Label>איש צוות</Label>
            <Select value={staffId} onValueChange={v => { setStaffId(v); setTemplateId(""); setPostId(""); setValidationErrors([]); }}>
              <SelectTrigger><SelectValue placeholder="בחר עובד..." /></SelectTrigger>
              <SelectContent>
                {activeStaff.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name} — {s.role === "guard" ? "מאבטח" : "מוקדן"}{s.qualification !== "none" ? ` (אחמ"ש)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>תבנית משמרת</Label>
              <Select value={templateId} onValueChange={v => { setTemplateId(v); setValidationErrors([]); }}>
                <SelectTrigger><SelectValue placeholder="בחר..." /></SelectTrigger>
                <SelectContent>
                  {availableTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.code} — {t.name} ({t.start_time}–{t.end_time})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>עמדה</Label>
              <Select value={postId} onValueChange={v => { setPostId(v); setValidationErrors([]); }}>
                <SelectTrigger><SelectValue placeholder="בחר..." /></SelectTrigger>
                <SelectContent>
                  {availablePosts.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.type === "control_room" ? "חדר מוקד" : "עמדה סטטית"})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="space-y-2">
              {validationErrors.map((err, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          {/* Emergency Override */}
          <div className="p-4 rounded-lg border border-amber-200 bg-amber-50">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={isEmergency} onCheckedChange={setIsEmergency} />
              חריגה חירומית
            </label>
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              מעקף הגבלות שעות משמרת/שבועי. כלל ה-8 שעות מנוחה תמיד נאכף.
            </p>
            {isEmergency && (
              <Input className="mt-2 ml-6" placeholder="סיבה לחריגה..." value={overrideReason} onChange={e => setOverrideReason(e.target.value)} />
            )}
          </div>

          <Button className="w-full" onClick={handleSave} disabled={!staffId || !templateId || !postId || !date || saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            שבץ משמרת
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}