'use client';

import { useState } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { ShiftEditPopover } from './ShiftEditPopover';
import type {
  Shift7Category,
  ShiftAssignmentRow,
  ShiftTemplateRow,
  StaffRow as StaffRecord,
} from '@/types/database.types';

const CATEGORY_CELL: Record<Shift7Category, string> = {
  morning: 'bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200',
  afternoon: 'bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-200',
  night: 'bg-violet-100 border-violet-300 text-violet-900 dark:bg-violet-950/50 dark:border-violet-800 dark:text-violet-200',
};
const QUAL_LABELS: Record<string, string> = { shift_supervisor: 'אחמ"ש', lead_dispatcher: 'אחר׳ מוקד' };

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface DayCellProps {
  staffId: string;
  date: string;
  dayAssignments: ShiftAssignmentRow[];
  templates: ShiftTemplateRow[];
  isToday: boolean;
}

function DayCell({ staffId, date, dayAssignments, templates, isToday }: DayCellProps) {
  const [editing, setEditing] = useState<ShiftAssignmentRow | null>(null);
  const cellAssignments = dayAssignments.filter(
    (a) => a.staff_id === staffId && a.date === date && a.status !== 'cancelled'
  );

  return (
    <>
      <Droppable droppableId={`${staffId}::${date}`}>
        {(provided, snapshot) => (
          <td
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'border border-border/30 p-1 align-top transition-colors',
              isToday && 'bg-primary/[0.03]',
              snapshot.isDraggingOver && 'border-primary/40 bg-primary/10'
            )}
            style={{ minWidth: 110, width: 110, verticalAlign: 'top' }}
          >
            <div className="min-h-[44px] space-y-1">
              {cellAssignments.map((a) => {
                const tpl = templates.find((t) => t.id === a.shift_template_id);
                const style = (tpl && CATEGORY_CELL[tpl.category]) || 'bg-muted border-border text-foreground';
                const sTime = new Date(a.actual_start).toLocaleTimeString('he-IL', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const eTime = new Date(a.actual_end).toLocaleTimeString('he-IL', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <div
                    key={a.id}
                    onClick={() => setEditing(a)}
                    className={cn(
                      'cursor-pointer rounded border px-1.5 py-1 text-[11px] font-medium transition-opacity hover:opacity-90 active:scale-95',
                      style
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <span className="shrink-0 text-sm font-black leading-none">{a.shift_code}</span>
                      <span className="truncate font-semibold" style={{ fontSize: 10 }}>
                        {tpl?.name}
                      </span>
                      {tpl?.post_number && (
                        <span className="rounded bg-black/10 px-1 text-[10px] font-bold">ע׳{tpl.post_number}</span>
                      )}
                    </div>
                    <div className="mt-0.5 opacity-70" style={{ fontSize: 10 }}>
                      {sTime} – {eTime}
                    </div>
                  </div>
                );
              })}
              {snapshot.isDraggingOver && cellAssignments.length === 0 && (
                <div className="flex h-8 items-center justify-center rounded border-2 border-dashed border-primary/50">
                  <span className="text-[10px] font-medium text-primary">שחרור</span>
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
        className="sticky right-0 z-[5] border-y border-border bg-muted/60 px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"
      >
        {label}
      </td>
    </tr>
  );
}

function SeparatorRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="h-0 p-0">
        <div
          className="flex items-center bg-muted/40 px-4 py-1.5"
          style={{ borderTop: '2px solid hsl(var(--border))', borderBottom: '2px solid hsl(var(--border))' }}
        >
          <div className="h-px flex-1 bg-border" />
          <span className="mx-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">מוקד</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      </td>
    </tr>
  );
}

interface StaffMatrixRowProps {
  member: StaffRecord;
  weekDays: Date[];
  weekAssignments: ShiftAssignmentRow[];
  templates: ShiftTemplateRow[];
  todayStr: string;
}

function StaffMatrixRow({ member, weekDays, weekAssignments, templates, todayStr }: StaffMatrixRowProps) {
  return (
    <tr className="transition-colors hover:bg-muted/10">
      <td
        className="sticky right-0 z-10 border border-border/30 bg-card px-3 py-2 text-right"
        style={{ minWidth: 150, width: 150 }}
      >
        <p className="whitespace-nowrap text-sm font-semibold leading-tight">{member.full_name}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {member.qualification !== 'none'
            ? QUAL_LABELS[member.qualification]
            : member.role === 'guard'
              ? 'מאבטח'
              : 'מוקדן'}
          {member.employee_id && <span className="mr-1 opacity-50">{member.employee_id}</span>}
        </p>
      </td>
      {weekDays.map((d) => (
        <DayCell
          key={toDateStr(d)}
          staffId={member.id}
          date={toDateStr(d)}
          dayAssignments={weekAssignments}
          templates={templates}
          isToday={toDateStr(d) === todayStr}
        />
      ))}
    </tr>
  );
}

interface WeeklyMatrixProps {
  weekDays: Date[];
  hebDays: string[];
  staff: StaffRecord[];
  effectiveFacilityId: string | null;
  hasControlRoom: boolean;
  weekAssignments: ShiftAssignmentRow[];
  templates: ShiftTemplateRow[];
  isGlobalView: boolean;
}

/** Weekly staff × day scheduling grid — drop a template card from ShiftCardsPanel onto a cell to schedule it. */
export function WeeklyMatrix({
  weekDays,
  hebDays,
  staff,
  effectiveFacilityId,
  hasControlRoom,
  weekAssignments,
  templates,
  isGlobalView,
}: WeeklyMatrixProps) {
  const todayStr = toDateStr(new Date());
  const colSpan = weekDays.length + 1;

  const facilityStaff = isGlobalView
    ? staff.filter((s) => s.status === 'active')
    : staff.filter((s) => s.primary_facility === effectiveFacilityId && s.status === 'active');
  const supervisors = facilityStaff.filter((s) => s.role === 'guard' && s.qualification === 'shift_supervisor');
  const guards = facilityStaff.filter((s) => s.role === 'guard' && s.qualification !== 'shift_supervisor');
  const leadDispatchers = facilityStaff.filter((s) => s.role === 'dispatcher' && s.qualification === 'lead_dispatcher');
  const dispatchers = facilityStaff.filter((s) => s.role === 'dispatcher' && s.qualification !== 'lead_dispatcher');

  const sharedRowProps = { weekDays, weekAssignments, templates, todayStr };

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
        <thead className="sticky top-0 z-20">
          <tr>
            <th
              className="sticky right-0 z-20 border border-border/40 bg-muted/80 px-3 py-3 text-right text-xs font-bold text-muted-foreground"
              style={{ minWidth: 150, width: 150, backdropFilter: 'blur(4px)' }}
            >
              עובד
            </th>
            {weekDays.map((d, i) => {
              const isToday = toDateStr(d) === todayStr;
              return (
                <th
                  key={i}
                  className={cn(
                    'border border-border/40 px-2 py-2.5 text-center text-xs font-semibold',
                    isToday ? 'bg-primary text-primary-foreground' : 'bg-muted/80 text-muted-foreground'
                  )}
                  style={{ minWidth: 110, width: 110 }}
                >
                  <div className="font-bold">{hebDays[i]}</div>
                  <div
                    className={cn(
                      'mt-0.5 text-[11px]',
                      isToday ? 'text-primary-foreground/80' : 'text-muted-foreground/70'
                    )}
                  >
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
                <StaffMatrixRow key={m.id} member={m} {...sharedRowProps} />
              ))}
            </>
          )}
          {guards.length > 0 && (
            <>
              <GroupHeader label="מאבטחים" colSpan={colSpan} />
              {guards.map((m) => (
                <StaffMatrixRow key={m.id} member={m} {...sharedRowProps} />
              ))}
            </>
          )}
          {hasControlRoom && (leadDispatchers.length > 0 || dispatchers.length > 0) && (
            <SeparatorRow colSpan={colSpan} />
          )}
          {hasControlRoom && leadDispatchers.length > 0 && (
            <>
              <GroupHeader label="אחראיות מוקד" colSpan={colSpan} />
              {leadDispatchers.map((m) => (
                <StaffMatrixRow key={m.id} member={m} {...sharedRowProps} />
              ))}
            </>
          )}
          {hasControlRoom && dispatchers.length > 0 && (
            <>
              <GroupHeader label="מוקדניות" colSpan={colSpan} />
              {dispatchers.map((m) => (
                <StaffMatrixRow key={m.id} member={m} {...sharedRowProps} />
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
