"use client";

import AssignmentDialog from "@/components/AssignmentDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Shield, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type ShiftAssignment = Database["public"]["Tables"]["shift_assignments"]["Row"];

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  in_progress: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-amber-100 text-amber-800",
};
const statusLabels: Record<string, string> = {
  scheduled: "מתוכנן",
  in_progress: "בביצוע",
  completed: "הושלם",
  cancelled: "בוטל",
  no_show: "לא הופיע",
};

function ShiftGroup({
  label,
  items,
  color,
  getFacilityName,
  onDelete,
}: {
  label: string;
  items: ShiftAssignment[];
  color: string;
  getFacilityName: (id: string) => string;
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label} ({items.length})
        </h3>
      </div>
      <div className="space-y-2">
        {items.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">{a.shift_code}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{a.staff_name}</span>
                  {a.is_emergency_override && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {a.post_name} · {getFacilityName(a.facility_id)} ·{" "}
                  {new Date(a.actual_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–
                  {new Date(a.actual_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[a.status] || ""}`}>
                {statusLabels[a.status] || a.status}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(a.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [facilityFilter, setFacilityFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["assignments", selectedDate],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("shift_assignments").select("*").eq("date", selectedDate);
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("shift_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("שיבוץ הוסר בהצלחה");
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
  });

  const filtered = facilityFilter === "all" ? assignments : assignments.filter((a) => a.facility_id === facilityFilter);

  const navigateDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const handleCreated = () => {
    qc.invalidateQueries({ queryKey: ["assignments"] });
    setDialogOpen(false);
  };

  const getFacilityName = (id: string) => facilities.find((f) => f.id === id)?.name || "—";

  const grouped = useMemo(() => {
    const groups: Record<"morning" | "afternoon" | "night" | "other", ShiftAssignment[]> = {
      morning: [],
      afternoon: [],
      night: [],
      other: [],
    };
    filtered.forEach((a) => {
      const hour = new Date(a.actual_start).getHours();
      if (hour >= 5 && hour < 12) groups.morning.push(a);
      else if (hour >= 12 && hour < 20) groups.afternoon.push(a);
      else if (hour >= 20 || hour < 5) groups.night.push(a);
      else groups.other.push(a);
    });
    return groups;
  }, [filtered]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="סידור עבודה" description="שיבוץ עובדים למשמרות עם אימות מוחלטת">
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> שבץ משמרת
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border-0 h-9 w-auto text-sm font-medium focus-visible:ring-0"
          />
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none" onClick={() => navigateDate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Select value={facilityFilter} onValueChange={setFacilityFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל המתקנים</SelectItem>
            {facilities.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-xs">
          {filtered.length} שיבוצים
        </Badge>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={Shield} title="אין שיבוצים" description={`אין משמרות מתוכננות ל-${selectedDate}`}>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> שבץ משמרת
          </Button>
        </EmptyState>
      ) : (
        <div>
          <ShiftGroup label="בוקר" items={grouped.morning} color="bg-amber-400" getFacilityName={getFacilityName} onDelete={(id) => deleteMutation.mutate(id)} />
          <ShiftGroup label="צהריים" items={grouped.afternoon} color="bg-blue-400" getFacilityName={getFacilityName} onDelete={(id) => deleteMutation.mutate(id)} />
          <ShiftGroup label="לילה" items={grouped.night} color="bg-violet-400" getFacilityName={getFacilityName} onDelete={(id) => deleteMutation.mutate(id)} />
          <ShiftGroup label="אחר" items={grouped.other} color="bg-gray-400" getFacilityName={getFacilityName} onDelete={(id) => deleteMutation.mutate(id)} />
        </div>
      )}

      <AssignmentDialog open={dialogOpen} onOpenChange={setDialogOpen} defaultDate={selectedDate} onCreated={handleCreated} />
    </div>
  );
}
