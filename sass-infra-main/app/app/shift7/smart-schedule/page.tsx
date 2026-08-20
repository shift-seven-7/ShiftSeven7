'use client';

import { useState } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { toast } from 'sonner';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useShift7Facilities } from '@/hooks/queries/useShift7Facilities';
import { useShift7Staff } from '@/hooks/queries/useShift7Staff';
import { useShift7ShiftTemplates } from '@/hooks/queries/useShift7ShiftTemplates';
import { useShift7Posts } from '@/hooks/queries/useShift7Posts';
import {
  useCreateShift7ShiftAssignment,
  usePublishShift7Schedule,
  useShift7ShiftAssignments,
} from '@/hooks/queries/useShift7ShiftAssignments';
import { validateRestPeriod } from '@/lib/shift7/shiftValidation';
import { WeeklyMatrix } from '@/components/features/shift7/smart-schedule/WeeklyMatrix';
import { ShiftCardsPanel } from '@/components/features/shift7/smart-schedule/ShiftCardsPanel';
import type { ShiftAssignmentRow } from '@/types/database.types';

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEB_MONTHS_SHORT = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יוני', 'יולי', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

/**
 * Looks up one staff member's nearby assignments for the 8-hour rest check —
 * a bounded window around the drop date rather than the original app's
 * "every assignment this person has ever had" fetch, since a rest-period
 * conflict can only ever come from an immediately adjacent shift.
 */
async function fetchStaffAssignmentsWindow(staffId: string, aroundDate: string): Promise<ShiftAssignmentRow[]> {
  const from = new Date(`${aroundDate}T00:00:00`);
  from.setDate(from.getDate() - 2);
  const to = new Date(`${aroundDate}T00:00:00`);
  to.setDate(to.getDate() + 2);
  const params = new URLSearchParams({ from: toDateStr(from), to: toDateStr(to), staffId });
  const response = await fetch(`/api/shift7/shift-assignments?${params.toString()}`);
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'טעינת שיבוצי העובד נכשלה');
  return json.shiftAssignments as ShiftAssignmentRow[];
}

export default function Shift7SmartSchedulePage() {
  const [weekAnchor, setWeekAnchor] = useState(() => getWeekStart(new Date()));
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);

  const { data: facilities = [] } = useShift7Facilities();
  const { data: staff = [] } = useShift7Staff();
  const { data: templates = [] } = useShift7ShiftTemplates();
  const { data: posts = [] } = useShift7Posts();

  const activeFacilities = facilities.filter((f) => f.status !== 'inactive');
  const isGlobalView = selectedFacilityId === 'all';
  const effectiveFacilityId = isGlobalView ? null : selectedFacilityId || activeFacilities[0]?.id || null;
  const currentFacility = activeFacilities.find((f) => f.id === effectiveFacilityId);

  const facilityPosts = isGlobalView
    ? posts.filter((p) => p.status === 'active')
    : posts.filter((p) => p.facility === effectiveFacilityId && p.status === 'active');
  const hasControlRoom = isGlobalView
    ? posts.some((p) => p.type === 'control_room' && p.status === 'active')
    : facilityPosts.some((p) => p.type === 'control_room');

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAnchor);
    d.setDate(weekAnchor.getDate() + i);
    return d;
  });
  const weekDateStrs = weekDays.map(toDateStr);
  const weekLabel = `${weekDays[0].getDate()} ${HEB_MONTHS_SHORT[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${HEB_MONTHS_SHORT[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`;

  const { data: weekAssignments = [] } = useShift7ShiftAssignments(
    weekDateStrs[0],
    weekDateStrs[6],
    isGlobalView ? undefined : (effectiveFacilityId ?? undefined)
  );

  const create = useCreateShift7ShiftAssignment();
  const publish = usePublishShift7Schedule();

  const navigateWeek = (dir: number) => {
    setWeekAnchor((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir * 7);
      return d;
    });
  };

  const handlePublish = async () => {
    const toPublish = weekAssignments.filter((a) => {
      if (a.status === 'cancelled' || a.is_published) return false;
      if (!isGlobalView && a.facility_id !== effectiveFacilityId) return false;
      return true;
    });
    if (toPublish.length === 0) {
      toast.info('כל המשמרות בסידור זה כבר מפורסמות');
      return;
    }
    try {
      const uniqueStaffNames = [...new Set(toPublish.map((a) => a.staff_name))];
      const result = await publish.mutateAsync({
        ids: toPublish.map((a) => a.id),
        weekLabel,
        facilityName: isGlobalView ? undefined : currentFacility?.name,
        staffNames: uniqueStaffNames,
      });
      toast.success(`הסידור פורסם בהצלחה! (${result.published} משמרות)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'פרסום הסידור נכשל');
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination || destination.droppableId === 'panel') return;

    // droppableId format: "staffId::date"
    const [staffId, date] = destination.droppableId.split('::');
    const templateId = draggableId.replace('tpl-', '');

    const member = staff.find((s) => s.id === staffId);
    const template = templates.find((t) => t.id === templateId);
    if (!member || !template) return;

    if (!template.applicable_roles.includes(member.role)) {
      toast.error(`תבנית "${template.name}" אינה מתאימה ל${member.role === 'guard' ? 'מאבטח' : 'מוקדן'}`);
      return;
    }

    const start = new Date(`${date}T${template.start_time.slice(0, 5)}:00`);
    const end = new Date(`${date}T${template.end_time.slice(0, 5)}:00`);
    if (end <= start) end.setDate(end.getDate() + 1);

    let nearbyAssignments: ShiftAssignmentRow[];
    try {
      nearbyAssignments = await fetchStaffAssignmentsWindow(staffId, date);
    } catch {
      nearbyAssignments = [];
    }
    const restCheck = validateRestPeriod(start.toISOString(), end.toISOString(), nearbyAssignments);
    if (!restCheck.valid) {
      toast.error(restCheck.error, { duration: 6000 });
      return;
    }

    // Non-blocking: the shift is scheduled either way, a post is just attached when one is free.
    const neededPostType = member.role === 'dispatcher' ? 'control_room' : 'static';
    const memberFacilityPosts = posts.filter((p) => p.facility === member.primary_facility && p.status === 'active');
    const availablePost = memberFacilityPosts.find(
      (p) => p.type === neededPostType && p.required_role === member.role
    );

    try {
      await create.mutateAsync({
        staff_id: staffId,
        staff_name: member.full_name,
        shift_template_id: templateId,
        shift_code: template.code,
        post_id: availablePost?.id ?? '',
        facility_id: member.primary_facility,
        date,
        actual_start: start.toISOString(),
        actual_end: end.toISOString(),
      });
      toast.success(`${member.full_name} שובץ למשמרת ${template.code}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שיבוץ המשמרת נכשל');
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <PageLayout
        title="ניהול סידור עבודה חכם"
        subtitle="מטריצת שיבוץ שבועית — גרור תבניות משמרת לתוך הטבלה"
        fullWidth
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-0.5">
              {activeFacilities.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFacilityId(f.id)}
                  className={cn(
                    'rounded-md px-4 py-1.5 text-sm font-semibold transition-all',
                    !isGlobalView && effectiveFacilityId === f.id
                      ? 'bg-primary text-primary-foreground shadow'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedFacilityId('all')}
                className={cn(
                  'rounded-md px-4 py-1.5 text-sm font-semibold transition-all',
                  isGlobalView ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                כלל הצוות
              </button>
            </div>
            <div className="flex items-center overflow-hidden rounded-lg border border-border bg-card">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => navigateWeek(-1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="min-w-[200px] select-none px-3 text-center text-sm font-semibold">{weekLabel}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => navigateWeek(1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setWeekAnchor(getWeekStart(new Date()))}
            >
              השבוע
            </Button>
          </div>
          <Button
            size="sm"
            className="h-8 gap-1.5 bg-green-600 text-xs hover:bg-green-700"
            onClick={handlePublish}
            disabled={publish.isPending}
          >
            <Send className="h-3.5 w-3.5" />
            {publish.isPending ? 'מפרסם...' : 'פרסם סידור'}
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 gap-4">
          <ShiftCardsPanel templates={templates} hasControlRoom={hasControlRoom} />
          <WeeklyMatrix
            weekDays={weekDays}
            hebDays={HEB_DAYS}
            staff={staff}
            effectiveFacilityId={effectiveFacilityId}
            hasControlRoom={hasControlRoom}
            weekAssignments={weekAssignments}
            templates={templates}
            isGlobalView={isGlobalView}
          />
        </div>
      </PageLayout>
    </DragDropContext>
  );
}
