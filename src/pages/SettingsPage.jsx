import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Settings, Building2, Plus, Pencil, Trash2, AlertTriangle, Save, MessageSquare } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_CONFIGS = [
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
  const { data: configs = [], isLoading } = useQuery({ queryKey: ["configs"], queryFn: () => base44.entities.SystemConfig.list() });
  const { data: facilities = [] } = useQuery({ queryKey: ["facilities"], queryFn: () => base44.entities.Facility.list() });
  
  const [localConfigs, setLocalConfigs] = useState({});
  const [facilityDialogOpen, setFacilityDialogOpen] = useState(false);
  const [facilityForm, setFacilityForm] = useState({ name: "", code: "", address: "" });
  const [editingFacilityId, setEditingFacilityId] = useState(null);

  useEffect(() => {
    const map = {};
    configs.forEach(c => { map[c.key] = { ...c }; });
    setLocalConfigs(map);
  }, [configs]);

  const initDefaults = async () => {
    const existing = configs.map(c => c.key);
    const missing = DEFAULT_CONFIGS.filter(d => !existing.includes(d.key));
    if (missing.length > 0) {
      await base44.entities.SystemConfig.bulkCreate(missing);
      qc.invalidateQueries({ queryKey: ["configs"] });
      toast.success(`אותחלו ${missing.length} הגדרות ברירת מחדל`);
    }
  };

  const saveConfig = async (key) => {
    const cfg = localConfigs[key];
    if (cfg?.id) {
      await base44.entities.SystemConfig.update(cfg.id, { value: cfg.value });
      toast.success(`Updated ${cfg.description || key}`);
      qc.invalidateQueries({ queryKey: ["configs"] });
    }
  };

  const updateLocal = (key, value) => {
    setLocalConfigs(prev => ({ ...prev, [key]: { ...prev[key], value } }));
  };

  const saveSlackChannel = async () => {
    const cfg = localConfigs["slack_notification_channel"];
    const value = cfg?.value || "";
    if (cfg?.id) {
      await base44.entities.SystemConfig.update(cfg.id, { value });
    } else {
      await base44.entities.SystemConfig.create({
        key: "slack_notification_channel",
        value,
        description: "Slack channel for schedule publish notifications",
        category: "emergency",
      });
    }
    qc.invalidateQueries({ queryKey: ["configs"] });
    toast.success("ערוץ Slack נשמר");
  };

  // Facility CRUD
  const openCreateFacility = () => { setEditingFacilityId(null); setFacilityForm({ name: "", code: "", address: "" }); setFacilityDialogOpen(true); };
  const openEditFacility = (f) => { setEditingFacilityId(f.id); setFacilityForm({ name: f.name, code: f.code, address: f.address || "" }); setFacilityDialogOpen(true); };

  const saveFacility = async () => {
    if (editingFacilityId) {
      await base44.entities.Facility.update(editingFacilityId, facilityForm);
      toast.success("מתקן עודכן");
    } else {
      await base44.entities.Facility.create({ ...facilityForm, status: "active" });
      toast.success("מתקן נוצר בהצלחה");
    }
    qc.invalidateQueries({ queryKey: ["facilities"] });
    setFacilityDialogOpen(false);
  };

  const deleteFacility = async (id) => {
    await base44.entities.Facility.delete(id);
    toast.success("מתקן הוסר בהצלחה");
    qc.invalidateQueries({ queryKey: ["facilities"] });
  };

  const emergencyMode = localConfigs["emergency_mode"]?.value === "true";

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <PageHeader title="הגדרות" description="קונפיגורציית מגבלות מערכת, כללי איוש ומתקנים">
        <Button variant="outline" onClick={initDefaults} className="gap-2 text-sm">
          <Settings className="w-4 h-4" /> אתחל ברירות מחדל
        </Button>
      </PageHeader>

      {/* Emergency Mode */}
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
            onCheckedChange={async (v) => {
              updateLocal("emergency_mode", v ? "true" : "false");
              if (localConfigs["emergency_mode"]?.id) {
                await base44.entities.SystemConfig.update(localConfigs["emergency_mode"].id, { value: v ? "true" : "false" });
                qc.invalidateQueries({ queryKey: ["configs"] });
                toast.success(v ? "מצב חירום הופעל" : "מצב חירום בוטל");
              }
            }}
          />
        </div>
      </div>

      {/* Dynamic Limits */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">מגבלות משמרת דינמיים</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {["max_shift_hours", "max_weekly_hours", "min_rest_hours"].map(key => {
            const cfg = localConfigs[key];
            if (!cfg) return null;
            return (
              <div key={key} className="space-y-2">
                <Label className="text-xs">{cfg.description || key}</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={cfg.value}
                    onChange={e => updateLocal(key, e.target.value)}
                    disabled={key === "min_rest_hours"}
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon" onClick={() => saveConfig(key)} disabled={key === "min_rest_hours"}>
                    <Save className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {key === "min_rest_hours" && (
                  <p className="text-xs text-muted-foreground">מגבלה קשיחה — לא ניתן לשנות</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Staffing Rules */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">כללי איוש משמרת בוקר</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {["morning_min_supervisors", "morning_min_guards", "morning_min_dispatchers"].map(key => {
            const cfg = localConfigs[key];
            if (!cfg) return null;
            return (
              <div key={key} className="space-y-2">
                <Label className="text-xs">{cfg.description || key}</Label>
                <div className="flex gap-2">
                  <Input type="number" value={cfg.value} onChange={e => updateLocal(key, e.target.value)} className="flex-1" />
                  <Button variant="outline" size="icon" onClick={() => saveConfig(key)}><Save className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Slack Notifications */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> התראות Slack
        </h3>
        <p className="text-xs text-muted-foreground mb-4">כאשר מנהל מפרסם סידור עבודה, תישלח הודעה אוטומטית לערוץ זה</p>
        <div className="flex gap-2">
          <Input
            value={localConfigs["slack_notification_channel"]?.value || ""}
            onChange={e => updateLocal("slack_notification_channel", e.target.value)}
            placeholder="#schedules"
            className="flex-1"
          />
          <Button variant="outline" size="icon" onClick={saveSlackChannel}>
            <Save className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Facilities */}
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
            {facilities.map(f => (
              <div key={f.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <span className="font-medium text-sm">{f.name}</span>
                  <Badge variant="outline" className="ml-2 text-xs">{f.code}</Badge>
                  {f.address && <span className="text-xs text-muted-foreground ml-2">{f.address}</span>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditFacility(f)}><Pencil className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteFacility(f.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Facility Dialog */}
      <Dialog open={facilityDialogOpen} onOpenChange={setFacilityDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingFacilityId ? "עריכת מתקן" : "הוספת מתקן"}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>שם</Label>
              <Input value={facilityForm.name} onChange={e => setFacilityForm({...facilityForm, name: e.target.value})} />
            </div>
            <div>
              <Label>קוד</Label>
              <Input value={facilityForm.code} onChange={e => setFacilityForm({...facilityForm, code: e.target.value})} placeholder="לדוגמא: KR" />
            </div>
            <div>
              <Label>כתובת</Label>
              <Input value={facilityForm.address} onChange={e => setFacilityForm({...facilityForm, address: e.target.value})} />
            </div>
            <Button className="w-full" onClick={saveFacility} disabled={!facilityForm.name || !facilityForm.code}>
              {editingFacilityId ? "עדכן" : "צור"} מתקן
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}