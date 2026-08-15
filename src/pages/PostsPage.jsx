import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const EMPTY_FORM = { name: "", code: "", type: "static", facility: "", required_role: "guard", status: "active" };

export default function PostsPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: posts = [], isLoading } = useQuery({ queryKey: ["posts"], queryFn: () => base44.entities.Post.list() });
  const { data: facilities = [] } = useQuery({ queryKey: ["facilities"], queryFn: () => base44.entities.Facility.list() });

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (p) => { setEditingId(p.id); setForm({ ...EMPTY_FORM, ...p }); setDialogOpen(true); };

  const handleSave = async () => {
    const data = { ...form };
    // Auto-set required_role based on type
    if (data.type === "control_room") data.required_role = "dispatcher";
    if (data.type === "static") data.required_role = "guard";

    if (editingId) {
      await base44.entities.Post.update(editingId, data);
      toast.success("עמדה עודכנה");
    } else {
      await base44.entities.Post.create(data);
      toast.success("עמדה נוצרה בהצלחה");
    }
    qc.invalidateQueries({ queryKey: ["posts"] });
    setDialogOpen(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.Post.delete(id);
    toast.success("עמדה הוסרה בהצלחה");
    qc.invalidateQueries({ queryKey: ["posts"] });
  };

  const getFacilityName = (id) => facilities.find(f => f.id === id)?.name || "—";

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="עמדות ועמדות שמירה" description="ניהול עמדות סטטיות ומוקדי בקרה">
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> הוסף עמדה</Button>
      </PageHeader>

      {posts.length === 0 && !isLoading ? (
        <EmptyState icon={MapPin} title="לא הוגדרו עמדות" description="צור עמדות למאבטחים ולמוקדנים.">
          <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> הוסף עמדה</Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono">{p.code}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={p.type === "control_room" ? "default" : "outline"} className="text-xs capitalize">{p.type.replace("_", " ")}</Badge>
                <Badge variant="secondary" className="text-xs capitalize">{p.required_role}</Badge>
                <Badge variant="secondary" className="text-xs">{getFacilityName(p.facility)}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "עריכת עמדה" : "הוספת עמדה"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>שם עמדה</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <Label>קוד</Label>
                <Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="לדוגמא: GP1" />
              </div>
              <div>
                <Label>סוג</Label>
                <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="static">עמדה סטטית</SelectItem>
                    <SelectItem value="control_room">חדר מוקד</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>מתקן</Label>
                <Select value={form.facility} onValueChange={v => setForm({...form, facility: v})}>
                  <SelectTrigger><SelectValue placeholder="בחר..." /></SelectTrigger>
                  <SelectContent>
                    {facilities.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={!form.name || !form.code || !form.facility}>
              {editingId ? "עדכן" : "צור"} עמדה
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}