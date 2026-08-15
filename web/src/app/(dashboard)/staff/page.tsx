"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, Plus, Search, Shield, ShieldCheck, ShieldX, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Staff = Database["public"]["Tables"]["staff"]["Row"];
type StaffInsert = Database["public"]["Tables"]["staff"]["Insert"];
type AccessLevel = Staff["access_level"];

interface StaffFormState {
  full_name: string;
  employee_id: string;
  role: string;
  qualification: string;
  primary_facility: string;
  phone: string;
  email: string;
  status: string;
  access_level: AccessLevel;
  weapon_license_expiry: string;
  weapon_refresh_expiry: string;
  medical_check_expiry: string;
}

const EMPTY_FORM: StaffFormState = {
  full_name: "",
  employee_id: "",
  role: "guard",
  qualification: "none",
  primary_facility: "",
  phone: "",
  email: "",
  status: "active",
  access_level: "employee",
  weapon_license_expiry: "",
  weapon_refresh_expiry: "",
  medical_check_expiry: "",
};

const ROLE_LABELS: Record<string, string> = { guard: "מאבטח", dispatcher: "מוקדן" };
const QUAL_LABELS: Record<string, string> = { shift_supervisor: 'אחמ"ש', lead_dispatcher: "אחראית מוקד" };
const STATUS_LABELS: Record<string, string> = { active: "פעיל", on_leave: "בחופשה", inactive: "לא פעיל" };
const ACCESS_LABELS: Record<string, { label: string; icon: typeof ShieldCheck; color: string }> = {
  admin: { label: "מנהל מערכת", icon: ShieldCheck, color: "text-purple-600 bg-purple-50 border-purple-200" },
  scheduler: { label: "משבץ", icon: Shield, color: "text-blue-600 bg-blue-50 border-blue-200" },
  employee: { label: "עובד", icon: Shield, color: "text-green-600 bg-green-50 border-green-200" },
  no_access: { label: "ללא גישה", icon: ShieldX, color: "text-gray-500 bg-gray-50 border-gray-200" },
};

function expiryWorst(s: Staff) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const creds = (
    [
      { key: "weapon_license_expiry" as const, label: "רישיון" },
      { key: "weapon_refresh_expiry" as const, label: "רענון" },
      { key: "medical_check_expiry" as const, label: "רפואי" },
    ] as const
  )
    .map((c) => {
      const val = s[c.key];
      if (!val) return null;
      const d = new Date(val + "T12:00:00");
      const days = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const level = days < 0 ? 3 : days <= 30 ? 2 : days <= 60 ? 1 : 0;
      return { label: c.label, days, level };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
  if (!creds.length) return null;
  return creds.reduce((a, b) => (b.level > a.level ? b : a));
}

export default function StaffPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("staff").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: facilities = [] } = useQuery({
    queryKey: ["facilities"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("facilities").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { id: string | null; data: StaffInsert }) => {
      const supabase = createClient();
      if (payload.id) {
        const { error } = await supabase.from("staff").update(payload.data).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("staff").insert(payload.data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("staff").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      setDeleteTarget(null);
    },
  });

  const filtered = staff.filter(
    (s) =>
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.employee_id.toLowerCase().includes(search.toLowerCase()),
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };
  const openEdit = (s: Staff) => {
    setEditingId(s.id);
    setForm({
      full_name: s.full_name,
      employee_id: s.employee_id,
      role: s.role,
      qualification: s.qualification,
      primary_facility: s.primary_facility,
      phone: s.phone || "",
      email: s.email || "",
      status: s.status,
      access_level: s.access_level,
      weapon_license_expiry: s.weapon_license_expiry || "",
      weapon_refresh_expiry: s.weapon_refresh_expiry || "",
      medical_check_expiry: s.medical_check_expiry || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const data: typeof form = { ...form };
    if (data.role === "guard" && data.qualification === "lead_dispatcher") data.qualification = "none";
    if (data.role === "dispatcher" && data.qualification === "shift_supervisor") data.qualification = "none";

    if (!editingId && !data.employee_id) {
      const existingIds = new Set(staff.map((s) => s.employee_id));
      const nums = staff.map((s) => parseInt(s.employee_id, 10)).filter((n) => !isNaN(n));
      let candidate = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
      while (existingIds.has(String(candidate))) candidate++;
      data.employee_id = String(candidate);
    }

    const dupEmployeeId = staff.find((s) => s.employee_id === data.employee_id && s.id !== editingId);
    if (dupEmployeeId) {
      toast.error(`מספר עובד "${data.employee_id}" כבר קיים אצל ${dupEmployeeId.full_name}`);
      return;
    }
    const dupName = staff.find((s) => s.full_name.trim() === data.full_name.trim() && s.id !== editingId);
    if (dupName) {
      toast.error(`עובד בשם "${data.full_name}" כבר קיים במערכת (מספר עובד: ${dupName.employee_id})`);
      return;
    }
    if (data.email) {
      const dupEmail = staff.find(
        (s) => s.email?.toLowerCase() === data.email.toLowerCase() && s.id !== editingId,
      );
      if (dupEmail) {
        toast.error(`אימייל "${data.email}" כבר קיים אצל ${dupEmail.full_name}`);
        return;
      }
    }
    if (data.phone) {
      const normalizedPhone = data.phone.replace(/[\s\-()]/g, "");
      const dupPhone = staff.find(
        (s) => s.phone && s.phone.replace(/[\s\-()]/g, "") === normalizedPhone && s.id !== editingId,
      );
      if (dupPhone) {
        toast.error(`טלפון "${data.phone}" כבר קיים אצל ${dupPhone.full_name}`);
        return;
      }
    }

    try {
      await saveMutation.mutateAsync({
        id: editingId,
        data: {
          ...data,
          weapon_license_expiry: data.weapon_license_expiry || null,
          weapon_refresh_expiry: data.weapon_refresh_expiry || null,
          medical_check_expiry: data.medical_check_expiry || null,
          phone: data.phone || null,
          email: data.email || null,
        },
      });
      toast.success(editingId ? "פרטי עובד עודכנו" : "עובד נוצר בהצלחה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשמירה");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success(`${deleteTarget.full_name} הוסר בהצלחה`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה במחיקה");
    }
  };

  const getFacilityName = (id: string) => facilities.find((f) => f.id === id)?.name || "—";

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="צוות העובדים" description="ניהול מאבטחים ומוקדנים">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="חיפוש..." className="pr-9 w-56" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> הוסף עובד
        </Button>
      </PageHeader>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={Users} title="לא נמצאו עובדים" description="הוסף את איש הצוות הראשון כדי להתחיל.">
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> הוסף עובד
          </Button>
        </EmptyState>
      ) : (
        <div>
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-sm text-blue-700">
            <Lock className="w-4 h-4 shrink-0" />
            <span>לכל עובד יש מספר עובד ייחודי וקבוע. המערכת מונעת כפילויות במספר עובד, שם, אימייל וטלפון.</span>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground">שם</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground">מספר עובד</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground">תפקיד</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground hidden sm:table-cell">מתקן</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground hidden md:table-cell">סטטוס</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground hidden lg:table-cell">הרשאות גישה</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground hidden lg:table-cell">תוקפים</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const acc = ACCESS_LABELS[s.access_level || "employee"];
                  const AccIcon = acc.icon;
                  const w = expiryWorst(s);
                  return (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-medium">{s.full_name}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold bg-muted px-2 py-0.5 rounded">
                            {s.employee_id}
                          </span>
                          <Lock className="w-3 h-3 text-muted-foreground/40" />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">
                          {ROLE_LABELS[s.role] || s.role}
                        </Badge>
                        {s.qualification !== "none" && QUAL_LABELS[s.qualification] && (
                          <Badge variant="secondary" className="mr-1.5 text-xs">
                            {QUAL_LABELS[s.qualification]}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">
                        {getFacilityName(s.primary_facility)}
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <Badge variant={s.status === "active" ? "default" : "secondary"} className="text-xs">
                          {STATUS_LABELS[s.status] || s.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${acc.color}`}
                        >
                          <AccIcon className="w-3 h-3" />
                          {acc.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        {!w ? (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              w.level >= 3
                                ? "bg-red-100 text-red-700 border-red-200"
                                : w.level === 2
                                  ? "bg-orange-100 text-orange-700 border-orange-200"
                                  : w.level === 1
                                    ? "bg-amber-100 text-amber-700 border-amber-200"
                                    : "bg-green-100 text-green-700 border-green-200"
                            }`}
                          >
                            {w.level >= 3 ? `${w.label}: פג` : `${w.label}: ${w.days}י`}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteTarget(s)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "עריכת עובד" : "הוספת איש צוות"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>שם מלא</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div>
                <Label>מספר עובד {editingId ? "(קבוע)" : "(אוטומטי אם ריק)"}</Label>
                <Input
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  disabled={!!editingId}
                  placeholder={editingId ? "" : "השאר ריק להפקה אוטומטית"}
                />
                {editingId && <p className="text-[10px] text-muted-foreground mt-1">מספר עובד קבוע — לא ניתן לשנות</p>}
              </div>
              <div>
                <Label>תפקיד</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v, qualification: "none" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guard">מאבטח</SelectItem>
                    <SelectItem value="dispatcher">מוקדן</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>הסמכה</Label>
                <Select value={form.qualification} onValueChange={(v) => setForm({ ...form, qualification: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">אין</SelectItem>
                    {form.role === "guard" && <SelectItem value="shift_supervisor">אחמ&quot;ש</SelectItem>}
                    {form.role === "dispatcher" && <SelectItem value="lead_dispatcher">אחראית מוקד</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>מתקן ראשי</Label>
                <Select
                  value={form.primary_facility}
                  onValueChange={(v) => setForm({ ...form, primary_facility: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר..." />
                  </SelectTrigger>
                  <SelectContent>
                    {facilities.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>טלפון</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>אימייל</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>סטטוס</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">פעיל</SelectItem>
                    <SelectItem value="on_leave">בחופשה</SelectItem>
                    <SelectItem value="inactive">לא פעיל</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>הרשאות גישה למערכת</Label>
                <Select
                  value={form.access_level}
                  onValueChange={(v) => setForm({ ...form, access_level: v as typeof form.access_level })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">מנהל מערכת — גישה מלאה לכל המודולים</SelectItem>
                    <SelectItem value="scheduler">משבץ — ניהול סידור עבודה</SelectItem>
                    <SelectItem value="employee">עובד — צפייה בסידור והגשת בקשות</SelectItem>
                    <SelectItem value="no_access">ללא גישה — רשומה בלבד</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border border-border p-3 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground mb-3">תוקפים ואישורים</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>תוקף רישיון נשק</Label>
                  <Input
                    type="date"
                    value={form.weapon_license_expiry || ""}
                    onChange={(e) => setForm({ ...form, weapon_license_expiry: e.target.value })}
                  />
                </div>
                <div>
                  <Label>תוקף רענון נשק</Label>
                  <Input
                    type="date"
                    value={form.weapon_refresh_expiry || ""}
                    onChange={(e) => setForm({ ...form, weapon_refresh_expiry: e.target.value })}
                  />
                </div>
                <div>
                  <Label>תוקף אישור רפואי</Label>
                  <Input
                    type="date"
                    value={form.medical_check_expiry || ""}
                    onChange={(e) => setForm({ ...form, medical_check_expiry: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleSave}
              disabled={!form.full_name || !form.primary_facility || saveMutation.isPending}
            >
              {editingId ? "עדכן" : "צור"} איש צוות
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>הסרת עובד</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך להסיר את &quot;{deleteTarget?.full_name}&quot; (מספר עובד: {deleteTarget?.employee_id})?
              פעולה זו תמחק את רשומת העובד. לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              הסר עובד
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
