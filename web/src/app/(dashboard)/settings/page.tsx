"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, MessageSquare, Pencil, Plus, Save, Settings, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type SystemConfig = Database["public"]["Tables"]["system_config"]["Row"];
type SystemConfigInsert = Database["public"]["Tables"]["system_config"]["Insert"];
type Facility = Database["public"]["Tables"]["facilities"]["Row"];

const DEFAULT_CONFIGS: SystemConfigInsert[] = [
  { key: "max_shift_hours", value: "12", description: "Maximum hours per single shift", category: "shift_limits" },
  { key: "max_weekly_hours", value: "60", description: "Maximum weekly hours per staff member", category: "shift_limits" },
  { key: "min_rest_hours", value: "8", description: "Minimum rest between shifts (HARD LIMIT)", category: "shift_limits" },
  { key: "emergency_mode", value: "false", description: "Enable emergency mode (wartime overrides)", category: "emergency" },
  { key: "morning_min_supervisors", value: "1", description: "Min shift supervisors for morning", category: "staffing_rules" },
  { key: "morning_min_guards", value: "5", description: "Min guards for morning", category: "staffing_rules" },
  { key: "morning_min_dispatchers", value: "1", description: "Min dispatchers for morning", category: "staffing_rules" },
  { key: "slack_notification_channel", value: "", description: "Slack channel for schedule publish notifications", category: "emergency" },
];

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data: configs = [] } = useQuery({
    queryKey: ["configs"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("system_config").select("*");
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

  const [localConfigs, setLocalConfigs] = useState<Record<string, SystemConfig>>({});
  const [facilityDialogOpen, setFacilityDialogOpen] = useState(false);
  const [facilityForm, setFacilityForm] = useState({ name: "", code: "", address: "" });
  const [editingFacilityId, setEditingFacilityId] = useState<string | null>(null);

  useEffect(() => {
    const map: Record<string, SystemConfig> = {};
    configs.forEach((c) => {
      map[c.key] = { ...c };
    });
    // Re-seeds local (editable) state whenever the server data changes -
    // legitimate sync-from-props-on-change, not a derivable value (the user
    // can locally edit values here before saving each one individually).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalConfigs(map);
  }, [configs]);

  const initDefaultsMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const existing = configs.map((c) => c.key);
      const missing = DEFAULT_CONFIGS.filter((d) => !existing.includes(d.key));
      if (missing.length > 0) {
        const { error } = await supabase.from("system_config").insert(missing);
        if (error) throw error;
      }
      return missing.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["configs"] });
      if (count > 0) toast.success(`אותחלו ${count} הגדרות ברירת מחדל`);
    },
  });

  const upsertConfigMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const supabase = createClient();
      const cfg = localConfigs[key];
      if (cfg?.id) {
        const { error } = await supabase.from("system_config").update({ value }).eq("id", cfg.id);
        if (error) throw error;
      } else {
        const defaults = DEFAULT_CONFIGS.find((d) => d.key === key);
        const { error } = await supabase.from("system_config").insert({
          key,
          value,
          description: defaults?.description ?? null,
          category: defaults?.category ?? "emergency",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["configs"] }),
  });

  const updateLocal = (key: string, value: string) => {
    setLocalConfigs((prev) => ({ ...prev, [key]: { ...prev[key], key, value } as SystemConfig }));
  };

  const saveConfig = async (key: string) => {
    try {
      await upsertConfigMutation.mutateAsync({ key, value: localConfigs[key]?.value ?? "" });
      toast.success(`עודכן ${localConfigs[key]?.description || key}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשמירה");
    }
  };

  const saveSlackChannel = async () => {
    try {
      await upsertConfigMutation.mutateAsync({
        key: "slack_notification_channel",
        value: localConfigs["slack_notification_channel"]?.value || "",
      });
      toast.success("ערוץ Slack נשמר");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשמירה");
    }
  };

  const toggleEmergencyMutation = useMutation({
    mutationFn: async (next: boolean) => {
      await upsertConfigMutation.mutateAsync({ key: "emergency_mode", value: next ? "true" : "false" });
    },
    onSuccess: (_data, next) => {
      toast.success(next ? "מצב חירום הופעל" : "מצב חירום בוטל");
    },
  });

  const facilitySaveMutation = useMutation({
    mutationFn: async (payload: { id: string | null; data: { name: string; code: string; address: string } }) => {
      const supabase = createClient();
      if (payload.id) {
        const { error } = await supabase.from("facilities").update(payload.data).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("facilities").insert({ ...payload.data, status: "active" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facilities"] });
      setFacilityDialogOpen(false);
    },
  });

  const facilityDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("facilities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["facilities"] }),
  });

  const openCreateFacility = () => {
    setEditingFacilityId(null);
    setFacilityForm({ name: "", code: "", address: "" });
    setFacilityDialogOpen(true);
  };
  const openEditFacility = (f: Facility) => {
    setEditingFacilityId(f.id);
    setFacilityForm({ name: f.name, code: f.code, address: f.address || "" });
    setFacilityDialogOpen(true);
  };

  const saveFacility = async () => {
    try {
      await facilitySaveMutation.mutateAsync({ id: editingFacilityId, data: facilityForm });
      toast.success(editingFacilityId ? "מתקן עודכן" : "מתקן נוצר בהצלחה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשמירה");
    }
  };

  const deleteFacility = async (id: string) => {
    try {
      await facilityDeleteMutation.mutateAsync(id);
      toast.success("מתקן הוסר בהצלחה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה במחיקה");
    }
  };

  const emergencyMode = localConfigs["emergency_mode"]?.value === "true";

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <PageHeader title="הגדרות" description="קונפיגורציית מגבלות מערכת, כללי איוש ומתקנים">
        <Button variant="outline" onClick={() => initDefaultsMutation.mutate()} className="gap-2 text-sm">
          <Settings className="w-4 h-4" /> אתחל ברירות מחדל
        </Button>
      </PageHeader>

      <div className={`rounded-xl border p-6 mb-6 ${emergencyMode ? "border-destructive bg-destructive/5" : "border-border bg-card"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className={`w-5 h-5 ${emergencyMode ? "text-destructive" : "text-muted-foreground"}`} />
            <div>
              <h3 className="font-semibold">מצב חירום</h3>
              <p className="text-xs text-muted-foreground">כשפעיל, ניתן לעקוף את מגבלות השעות. כלל 8 שעות מנוחה תמיד נאכף.</p>
            </div>
          </div>
          <Switch
            checked={emergencyMode}
            onCheckedChange={(v) => {
              updateLocal("emergency_mode", v ? "true" : "false");
              if (localConfigs["emergency_mode"]?.id) toggleEmergencyMutation.mutate(v);
            }}
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">מגבלות משמרת דינמיים</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {["max_shift_hours", "max_weekly_hours", "min_rest_hours"].map((key) => {
            const cfg = localConfigs[key];
            if (!cfg) return null;
            return (
              <div key={key} className="space-y-2">
                <Label className="text-xs">{cfg.description || key}</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={cfg.value}
                    onChange={(e) => updateLocal(key, e.target.value)}
                    disabled={key === "min_rest_hours"}
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon" onClick={() => saveConfig(key)} disabled={key === "min_rest_hours"}>
                    <Save className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {key === "min_rest_hours" && <p className="text-xs text-muted-foreground">מגבלה קשיחה — לא ניתן לשנות</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">כללי איוש משמרת בוקר</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {["morning_min_supervisors", "morning_min_guards", "morning_min_dispatchers"].map((key) => {
            const cfg = localConfigs[key];
            if (!cfg) return null;
            return (
              <div key={key} className="space-y-2">
                <Label className="text-xs">{cfg.description || key}</Label>
                <div className="flex gap-2">
                  <Input type="number" value={cfg.value} onChange={(e) => updateLocal(key, e.target.value)} className="flex-1" />
                  <Button variant="outline" size="icon" onClick={() => saveConfig(key)}>
                    <Save className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> התראות Slack
        </h3>
        <p className="text-xs text-muted-foreground mb-4">כאשר מנהל מפרסם סידור עבודה, תישלח הודעה אוטומטית לערוץ זה</p>
        <div className="flex gap-2">
          <Input
            value={localConfigs["slack_notification_channel"]?.value || ""}
            onChange={(e) => updateLocal("slack_notification_channel", e.target.value)}
            placeholder="#schedules"
            className="flex-1"
          />
          <Button variant="outline" size="icon" onClick={saveSlackChannel}>
            <Save className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">מתקנים</h3>
          <Button variant="outline" size="sm" onClick={openCreateFacility} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> הוסף מתקן
          </Button>
        </div>
        {facilities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">אין מתקנים. הוסף את המתקן הראשון כדי להתחיל.</p>
        ) : (
          <div className="space-y-2">
            {facilities.map((f) => (
              <div key={f.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <span className="font-medium text-sm">{f.name}</span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {f.code}
                  </Badge>
                  {f.address && <span className="text-xs text-muted-foreground ml-2">{f.address}</span>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditFacility(f)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteFacility(f.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={facilityDialogOpen} onOpenChange={setFacilityDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingFacilityId ? "עריכת מתקן" : "הוספת מתקן"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>שם</Label>
              <Input value={facilityForm.name} onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })} />
            </div>
            <div>
              <Label>קוד</Label>
              <Input value={facilityForm.code} onChange={(e) => setFacilityForm({ ...facilityForm, code: e.target.value })} placeholder="לדוגמא: KR" />
            </div>
            <div>
              <Label>כתובת</Label>
              <Input value={facilityForm.address} onChange={(e) => setFacilityForm({ ...facilityForm, address: e.target.value })} />
            </div>
            <Button className="w-full" onClick={saveFacility} disabled={!facilityForm.name || !facilityForm.code || facilitySaveMutation.isPending}>
              {editingFacilityId ? "עדכן" : "צור"} מתקן
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
