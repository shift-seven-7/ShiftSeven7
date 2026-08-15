"use client";

import EmployeeRequestList from "@/components/EmployeeRequestList";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

type StatusFilter = "pending" | "approved" | "rejected" | "all";

export default function RequestsManagementPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["employee-requests-all"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("employee_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const filtered = useMemo(() => {
    if (statusFilter === "all") return requests;
    return requests.filter((r) => r.status === statusFilter);
  }, [requests, statusFilter]);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    requests.forEach((r) => {
      c[r.status as keyof typeof c] = (c[r.status as keyof typeof c] || 0) + 1;
    });
    return c;
  }, [requests]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["employee-requests-all"] });

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: "pending", label: `ממתינות (${counts.pending})` },
    { key: "approved", label: `אושרו (${counts.approved})` },
    { key: "rejected", label: `נדחו (${counts.rejected})` },
    { key: "all", label: `הכל (${requests.length})` },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto" dir="rtl">
      <PageHeader title="ניהול בקשות עובדים" description="אישור ודחיית בקשות חופשה, מילואים, מחלה, רישיון נשק ועוד" />

      {counts.pending > 0 && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          {counts.pending} בקשות ממתינות לטיפולך
        </div>
      )}

      <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5 border border-border w-fit mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
              statusFilter === t.key ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <EmployeeRequestList requests={filtered} admin onAction={refresh} />
      )}
    </div>
  );
}
