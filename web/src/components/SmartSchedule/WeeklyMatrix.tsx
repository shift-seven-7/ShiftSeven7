"use client";

import ShiftEditPopover from "@/components/SmartSchedule/ShiftEditPopover";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { Droppable } from "@hello-pangea/dnd";
import { useState } from "react";

type ShiftAssignment = Database["public"]["Tables"]["shift_assignments"]["Row"];
type ShiftTemplate = Database["public"]["Tables"]["shift_templates"]["Row"];
type Staff = Database["public"]["Tables"]["staff"]["Row"];

const CATEGORY_CELL: Record<string, string> = {
  morning: "bg-amber-100 border-amber-300 text-amber-900",
  afternoon: "bg-blue-100 border-blue-300 text-blue-900",
  night: "bg-violet-100 border-violet-300 text-violet-900",
};
const QUAL_LABELS: Record<string, string> = { shift_supervisor: 'אחמ"ש', lead_dispatcher: "אחר׳ מוקד" };

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function DayCell({
  staffId,
  date,
  dayAssignments,
  templates,
  onRefresh,
  isToday,
}: {
  staffId: string;
  date: string;
  dayAssignments: ShiftAssignment[];
  templates: ShiftTemplate[];
  onRefresh?: () => void;
  isToday: boolean;
}) {
  const [editing, setEditing] = useState<ShiftAssignment | null>(null);
  const cellAssignments = dayAssignments.filter(
    (a) => a.staff_id === staffId && a.date === date && a.status !== "cancelled",
  );

  return (
    <>
      <Droppable droppableId={`${staffId}::${date}`}>
        {(provided, snapshot) => (
          <td
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "border border-border/30 p-1 align-top transition-colors",
              isToday && "bg-primary/[0.03]",
              snapshot.isDraggingOver && "bg-primary/10 border-primary/40",
            )}
            style={{ minWidth: 110, width: 110, verticalAlign: "top" }}
          >
            <div className="space-y-1 min-h-[44px]">
              {cellAssignments.map((a) => {
                const tpl = templates.find((t) => t.id === a.shift_template_id);
                const style = (tpl && CATEGORY_CELL[tpl.category]) || "bg-gray-100 border-gray-200 text-gray-800";
                const sTime = new Date(a.actual_start).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
                const eTime = new Date(a.actual_end).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
                return (
                  <div
                    key={a.id}
                    onClick={() => setEditing(a)}
                    className={cn(
                      "px-1.5 py-1 rounded border text-[11px] font-medium cursor-pointer hover:opacity-90 transition-opacity active:scale-95",
                      style,
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <span className="font-black text-sm leading-none shrink-0">{a.shift_code}</span>
                      <span className="font-semibold truncate" style={{ fontSize: 10 }}>
                        {tpl?.name}
                      </span>
                      {tpl?.post_number && (
                        <span className="font-bold text-[10px] bg-black/10 rounded px-1">ע׳{tpl.post_number}</span>
                      )}
                    </div>
                    <div className="opacity-70 mt-0.5" style={{ fontSize: 10 }}>
                      {sTime} – {eTime}
                    </div>
                  </div>
                );
              })}
              {snapshot.isDraggingOver && cellAssignments.length === 0 && (
                <div className="h-8 rounded border-2 border-dashed border-primary/50 flex items-center justify-center">
                  <span className="text-[10px] text-primary font-medium">שחרור</span>
                </div>
              )}
            </div>
            {provided.placeholder}
          </td>
        )}
      </Droppable>
      {editing && (
        <ShiftEditPopover
          assignment={editing}
          template={templates.find((t) => t.id === editing.shift_template_id)}
          open={!!editing}
          onClose={() => setEditing(null)}
          onSaved={onRefresh}
        />
      )}
    </>
  );
}

function GroupHeader({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-2 bg-muted/60 border-y border-border text-xs font-bold uppercase tracking-widest text-muted-foreground sticky right-0"
        style={{ position: "sticky", right: 0, zIndex: 5 }}
      >
        {label}
      </td>
    </tr>
  );
}

function SeparatorRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0 h-0">
        <div
          className="flex items-center px-4 py-1.5 bg-muted/40"
          style={{ borderTop: "2px solid hsl(var(--border))", borderBottom: "2px solid hsl(var(--border))" }}
        >
          <div className="flex-1 h-px bg-border" />
          <span className="mx-3 text-[10px] font-bold text-muted-foreground tracking-widest uppercase">מוקד</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      </td>
    </tr>
  );
}

function StaffRow({
  member,
  weekDays,
  weekAssignments,
  templates,
  onRefresh,
  todayStr,
}: {
  member: Staff;
  weekDays: Date[];
  weekAssignments: ShiftAssignment[];
  templates: ShiftTemplate[];
  onRefresh?: () => void;
  todayStr: string;
}) {
  return (
    <tr className="hover:bg-muted/10 transition-colors">
      <td className="border border-border/30 bg-card px-3 py-2 text-right sticky right-0 z-10" style={{ minWidth: 150, width: 150 }}>
        <p className="text-sm font-semibold leading-tight whitespace-nowrap">{member.full_name}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {member.qualification !== "none" ? QUAL_LABELS[member.qualification] : member.role === "guard" ? "מאבטח" : "מוקדן"}
          {member.employee_id && <span className="opacity-50 mr-1"> {member.employee_id}</span>}
        </p>
      </td>
      {weekDays.map((d) => (
        <DayCell
          key={toDateStr(d)}
          staffId={member.id}
          date={toDateStr(d)}
          dayAssignments={weekAssignments}
          templates={templates}
          onRefresh={onRefresh}
          isToday={toDateStr(d) === todayStr}
        />
      ))}
    </tr>
  );
}

export default function WeeklyMatrix({
  weekDays,
  hebDays,
  staff,
  effectiveFacilityId,
  hasControlRoom,
  weekAssignments,
  templates,
  onRefresh,
  isGlobalView,
}: {
  weekDays: Date[];
  hebDays: string[];
  staff: Staff[];
  effectiveFacilityId: string | null;
  hasControlRoom: boolean;
  weekAssignments: ShiftAssignment[];
  templates: ShiftTemplate[];
  onRefresh?: () => void;
  isGlobalView: boolean;
}) {
  const todayStr = toDateStr(new Date());
  const colSpan = weekDays.length + 1;

  const facilityStaff = isGlobalView
    ? staff.filter((s) => s.status === "active")
    : staff.filter((s) => s.primary_facility === effectiveFacilityId && s.status === "active");
  const supervisors = facilityStaff.filter((s) => s.role === "guard" && s.qualification === "shift_supervisor");
  const guards = facilityStaff.filter((s) => s.role === "guard" && s.qualification !== "shift_supervisor");
  const leadDispatchers = facilityStaff.filter((s) => s.role === "dispatcher" && s.qualification === "lead_dispatcher");
  const dispatchers = facilityStaff.filter((s) => s.role === "dispatcher" && s.qualification !== "lead_dispatcher");

  const sharedRowProps = { weekDays, weekAssignments, templates, onRefresh, todayStr };

  return (
    <div className="flex-1 overflow-auto rounded-xl border border-border shadow-sm bg-card min-h-0">
      <table className="border-collapse w-full" style={{ tableLayout: "fixed" }}>
        <thead className="sticky top-0 z-20">
          <tr>
            <th
              className="bg-muted/80 border border-border/40 px-3 py-3 text-right text-xs font-bold text-muted-foreground sticky right-0 z-20"
              style={{ minWidth: 150, width: 150, backdropFilter: "blur(4px)" }}
            >
              עובד
            </th>
            {weekDays.map((d, i) => {
              const isToday = toDateStr(d) === todayStr;
              return (
                <th
                  key={i}
                  className={cn(
                    "border border-border/40 px-2 py-2.5 text-center text-xs font-semibold",
                    isToday ? "bg-primary text-primary-foreground" : "bg-muted/80 text-muted-foreground",
                  )}
                  style={{ minWidth: 110, width: 110 }}
                >
                  <div className="font-bold">{hebDays[i]}</div>
                  <div className={cn("text-[11px] mt-0.5", isToday ? "text-primary-foreground/80" : "text-muted-foreground/70")}>
                    {d.getDate()}/{d.getMonth() + 1}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {supervisors.length > 0 && (
            <>
              <GroupHeader label='אחמ"שים' colSpan={colSpan} />
              {supervisors.map((m) => (
                <StaffRow key={m.id} member={m} {...sharedRowProps} />
              ))}
            </>
          )}
          {guards.length > 0 && (
            <>
              <GroupHeader label="מאבטחים" colSpan={colSpan} />
              {guards.map((m) => (
                <StaffRow key={m.id} member={m} {...sharedRowProps} />
              ))}
            </>
          )}
          {hasControlRoom && (leadDispatchers.length > 0 || dispatchers.length > 0) && <SeparatorRow colSpan={colSpan} />}
          {hasControlRoom && leadDispatchers.length > 0 && (
            <>
              <GroupHeader label="אחראיות מוקד" colSpan={colSpan} />
              {leadDispatchers.map((m) => (
                <StaffRow key={m.id} member={m} {...sharedRowProps} />
              ))}
            </>
          )}
          {hasControlRoom && dispatchers.length > 0 && (
            <>
              <GroupHeader label="מוקדניות" colSpan={colSpan} />
              {dispatchers.map((m) => (
                <StaffRow key={m.id} member={m} {...sharedRowProps} />
              ))}
            </>
          )}
          {facilityStaff.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="py-20 text-center text-sm text-muted-foreground">
                אין עובדים פעילים המשויכים למתקן זה
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
