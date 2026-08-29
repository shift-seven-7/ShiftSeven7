"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useImpersonation, type StaffRow } from "@/lib/impersonation-context";
import { cn } from "@/lib/utils";
import { CheckCircle2, ChevronUp, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const ROLE_LABELS: Record<string, string> = { guard: "מאבטח", dispatcher: "מוקדן" };
const QUAL_LABELS: Record<string, string> = { shift_supervisor: 'אחמ"ש', lead_dispatcher: "אחראית מוקד" };

function initials(name: string | undefined | null) {
  return (
    (name || "")
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("") || "?"
  );
}
function staffTag(s: StaffRow) {
  if (s.qualification === "shift_supervisor") return QUAL_LABELS.shift_supervisor;
  if (s.qualification === "lead_dispatcher") return QUAL_LABELS.lead_dispatcher;
  return ROLE_LABELS[s.role] || s.role || "עובד";
}

export default function UserSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { staffList, isAdmin, isImpersonating, effectiveStaff, setImpersonation, clearImpersonation } =
    useImpersonation();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staffList;
    return staffList.filter(
      (s) => (s.full_name || "").toLowerCase().includes(q) || String(s.employee_id || "").includes(q),
    );
  }, [staffList, search]);

  const groups = useMemo(() => {
    const g: { key: string; label: string; items: StaffRow[] }[] = [
      { key: "lead", label: 'הסמכות (אחמ"ש / אחראית מוקד)', items: [] },
      { key: "guard", label: "מאבטחים", items: [] },
      { key: "dispatcher", label: "מוקדנים", items: [] },
    ];
    filtered.forEach((s) => {
      if (s.qualification && s.qualification !== "none") g[0].items.push(s);
      else if (s.role === "guard") g[1].items.push(s);
      else g[2].items.push(s);
    });
    g.forEach((grp) => grp.items.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "", "he")));
    return g.filter((grp) => grp.items.length > 0);
  }, [filtered]);

  if (!isAdmin) return null;

  const triggerLabel = isImpersonating ? effectiveStaff?.full_name || "מצב בדיקה" : "פרופיל מנהל";

  const selectStaff = (s: StaffRow) => {
    setImpersonation(s.id);
    router.push("/my-area");
  };
  const backToAdmin = () => {
    clearImpersonation();
    router.push("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border text-sm font-medium transition-colors",
            isImpersonating
              ? "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100"
              : "bg-muted/40 border-border hover:bg-muted",
          )}
        >
          <div
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
              isImpersonating ? "bg-amber-500 text-white" : "bg-primary text-primary-foreground",
            )}
          >
            {isImpersonating ? initials(effectiveStaff?.full_name) : <ShieldCheck className="w-3.5 h-3.5" />}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0 text-right overflow-hidden">
              <p className="truncate text-xs font-semibold">{triggerLabel}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {isImpersonating ? "מצב בדיקה" : "מנהל ראשי"}
              </p>
            </div>
          )}
          {!collapsed && <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className="w-72 max-h-[70vh] overflow-y-auto">
        <DropdownMenuItem
          onClick={backToAdmin}
          className={cn("gap-2 font-semibold cursor-pointer", !isImpersonating && "text-green-700")}
        >
          <RotateCcw className="w-4 h-4" />
          <div className="flex flex-col">
            <span>חזור לפרופיל מנהל ראשי (Admin)</span>
            {!isImpersonating && <span className="text-[10px] text-muted-foreground font-normal">מצב נוכחי</span>}
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <div className="p-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="חיפוש עובד..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pr-8 text-xs"
            />
          </div>
        </div>

        {groups.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">לא נמצאו עובדים</p>}

        {groups.map((grp) => (
          <div key={grp.key}>
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">{grp.label}</DropdownMenuLabel>
            {grp.items.map((s) => {
              const active = isImpersonating && effectiveStaff?.id === s.id;
              return (
                <DropdownMenuItem
                  key={s.id}
                  onClick={() => selectStaff(s)}
                  className={cn("gap-2 cursor-pointer", active && "bg-primary/10")}
                >
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                    {initials(s.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{s.full_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {staffTag(s)} · #{s.employee_id}
                    </p>
                  </div>
                  {active && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                </DropdownMenuItem>
              );
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
