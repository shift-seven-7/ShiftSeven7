// Adapted from the old app's lib/staffingRequirements.ts. The original
// indexed by a short facility "code" (e.g. "KR") with a hardcoded default
// requirements map baked into the frontend; this schema has no such code —
// staffing_requirements rows are keyed by facility_id, the real FK already
// managed by the staffing-requirements page — so this indexes on that
// instead of the code/name string-matching the original used.

export type DayGroup = 'weekday' | 'friday' | 'saturday';
export type Category = 'morning' | 'afternoon' | 'night';

export interface RequirementCounts {
  supervisor?: number;
  guard?: number;
  dispatcher?: number;
}

type FacilityRequirementConfig = Partial<Record<DayGroup, Partial<Record<Category, RequirementCounts>>>>;

export const CATEGORY_LABELS: Record<Category, string> = {
  morning: 'בוקר',
  afternoon: 'צהריים',
  night: 'לילה',
};
export const CATEGORY_ORDER: Category[] = ['morning', 'afternoon', 'night'];
export const CAPABILITY_LABELS: Record<string, string> = {
  supervisor: 'אחמ"ש',
  guard: 'מאבטח',
  dispatcher: 'מוקדנית',
};

export const DAY_GROUPS: { key: DayGroup; label: string }[] = [
  { key: 'weekday', label: 'א׳–ה׳' },
  { key: 'friday', label: 'שישי' },
  { key: 'saturday', label: 'שבת' },
];

export function getDayGroup(date: Date): DayGroup {
  const day = date.getDay();
  if (day === 5) return 'friday';
  if (day === 6) return 'saturday';
  return 'weekday';
}

export interface StaffingRequirementRecord {
  facility_id: string;
  day_group: DayGroup;
  category: Category;
  supervisor?: number;
  guard?: number;
  dispatcher?: number;
}

/** Maps facility_id -> its per-day-group, per-category requirement counts. */
export function buildRequirementsMap(
  records: StaffingRequirementRecord[] | null | undefined
): Record<string, FacilityRequirementConfig> {
  const map: Record<string, FacilityRequirementConfig> = {};
  (records || []).forEach((r) => {
    const id = r.facility_id;
    if (!id) return;
    if (!map[id]) map[id] = {};
    if (!map[id][r.day_group]) map[id][r.day_group] = {};
    if (r.supervisor || r.guard || r.dispatcher) {
      map[id][r.day_group]![r.category] = {
        supervisor: r.supervisor || 0,
        guard: r.guard || 0,
        dispatcher: r.dispatcher || 0,
      };
    } else {
      delete map[id][r.day_group]![r.category];
    }
  });
  return map;
}

export function getFacilityRequirementConfig(
  facilityId: string | null | undefined,
  requirementsMap: Record<string, FacilityRequirementConfig>
): FacilityRequirementConfig | null {
  if (!facilityId) return null;
  return requirementsMap[facilityId] ?? null;
}

export function getRequirement(
  facilityId: string | null | undefined,
  date: Date,
  category: Category,
  requirementsMap: Record<string, FacilityRequirementConfig>
): RequirementCounts | null {
  const config = getFacilityRequirementConfig(facilityId, requirementsMap);
  if (!config) return null;
  const group = getDayGroup(date);
  return config[group]?.[category] || null;
}

export interface StaffMemberLike {
  qualification?: string;
  role?: string;
}

export function capabilityOf(staffMember: StaffMemberLike | null | undefined): string {
  if (!staffMember) return 'guard';
  if (staffMember.qualification === 'shift_supervisor') return 'supervisor';
  if (staffMember.role === 'guard') return 'guard';
  return 'dispatcher';
}

export interface AssignmentPoolLike {
  status?: string;
  staff_id?: string;
}

export function buildPool(
  assignments: AssignmentPoolLike[] | null | undefined,
  staffMap: Record<string, StaffMemberLike> | undefined
): Record<string, number> {
  const pool: Record<string, number> = { supervisor: 0, guard: 0, dispatcher: 0 };
  (assignments || [])
    .filter((a) => a && a.status !== 'cancelled' && a.staff_id)
    .forEach((a) => {
      const cap = capabilityOf(staffMap?.[a.staff_id!]);
      pool[cap] = (pool[cap] || 0) + 1;
    });
  return pool;
}

export interface ShortageDetail {
  capability: string;
  required: number;
  shortage: number;
}

export interface ShortageResult {
  shortSup: number;
  shortGuard: number;
  shortDisp: number;
  totalRequired: number;
  totalAssigned: number;
  totalShortage: number;
  details: ShortageDetail[];
}

export function computeShortage(
  requirement: RequirementCounts | null | undefined,
  pool: Record<string, number>
): ShortageResult {
  const req = requirement || {};
  let sup = pool.supervisor || 0;
  const grd = pool.guard || 0;
  const dsp = pool.dispatcher || 0;

  const reqSup = req.supervisor || 0;
  const fillSup = Math.min(reqSup, sup);
  sup -= fillSup;
  const shortSup = reqSup - fillSup;

  const reqGuard = req.guard || 0;
  const guardPool = sup + grd;
  const fillGuard = Math.min(reqGuard, guardPool);
  const leftover = guardPool - fillGuard;
  const shortGuard = reqGuard - fillGuard;

  const reqDisp = req.dispatcher || 0;
  const dispPool = leftover + dsp;
  const fillDisp = Math.min(reqDisp, dispPool);
  const shortDisp = reqDisp - fillDisp;

  const totalRequired = reqSup + reqGuard + reqDisp;
  const totalAssigned = fillSup + fillGuard + fillDisp;
  const totalShortage = shortSup + shortGuard + shortDisp;

  return {
    shortSup,
    shortGuard,
    shortDisp,
    totalRequired,
    totalAssigned,
    totalShortage,
    details: [
      { capability: 'supervisor', required: reqSup, shortage: shortSup },
      { capability: 'guard', required: reqGuard, shortage: shortGuard },
      { capability: 'dispatcher', required: reqDisp, shortage: shortDisp },
    ].filter((d) => d.required > 0),
  };
}

export function shortageText(shortage: ShortageResult | null | undefined): string {
  if (!shortage) return '';
  const parts: string[] = [];
  if (shortage.shortSup > 0) parts.push(`${shortage.shortSup} ${CAPABILITY_LABELS.supervisor}`);
  if (shortage.shortGuard > 0) parts.push(`${shortage.shortGuard} ${CAPABILITY_LABELS.guard}`);
  if (shortage.shortDisp > 0) parts.push(`${shortage.shortDisp} ${CAPABILITY_LABELS.dispatcher}`);
  return parts.join(', ');
}
