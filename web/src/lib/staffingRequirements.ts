// Ported from the old app's src/lib/staffingRequirements.js.
// תקינת ברירת מחדל (מקור היסטורי). משמשת כברירת מחדל כאשר אין רשומת DB
// עבור משבצת, וכן לאיתחול הערכים בממשק הניהול. עריכות המשתמש נשמרות
// בטבלת staffing_requirements וגוברות על ברירת המחדל.

export type DayGroup = "weekday" | "friday" | "saturday";
export type Category = "morning" | "afternoon" | "night";

export interface RequirementCounts {
  supervisor?: number;
  guard?: number;
  dispatcher?: number;
}

type FacilityRequirementConfig = Partial<Record<DayGroup, Partial<Record<Category, RequirementCounts>>>>;

export const STAFFING_REQUIREMENTS: Record<string, FacilityRequirementConfig> = {
  KR: {
    weekday: {
      morning: { supervisor: 1, guard: 5, dispatcher: 1 },
      afternoon: { guard: 1, dispatcher: 1 },
      night: { guard: 1 },
    },
    friday: {
      morning: { guard: 1, dispatcher: 1 },
      afternoon: { guard: 1 },
      night: { guard: 1 },
    },
    saturday: {
      morning: { guard: 1 },
      afternoon: { guard: 1 },
      night: { guard: 1 },
    },
  },
  TL: {
    weekday: {
      morning: { supervisor: 1, guard: 1 },
      afternoon: { guard: 1 },
    },
    friday: {},
    saturday: {},
  },
};

export const CATEGORY_LABELS: Record<Category, string> = {
  morning: "בוקר",
  afternoon: "צהריים",
  night: "לילה",
};
export const CATEGORY_ORDER: Category[] = ["morning", "afternoon", "night"];
export const CAPABILITY_LABELS: Record<string, string> = {
  supervisor: 'אחמ"ש',
  guard: "מאבטח",
  dispatcher: "מוקדנית",
};

export const DAY_GROUPS: { key: DayGroup; label: string }[] = [
  { key: "weekday", label: "א׳–ה׳" },
  { key: "friday", label: "שישי" },
  { key: "saturday", label: "שבת" },
];

export function getDayGroup(date: Date): DayGroup {
  const day = date.getDay();
  if (day === 5) return "friday";
  if (day === 6) return "saturday";
  return "weekday";
}

export interface StaffingRequirementRecord {
  facility_code?: string;
  day_group: DayGroup;
  category: Category;
  supervisor?: number;
  guard?: number;
  dispatcher?: number;
}

/**
 * בונה מפת תקינה אפקטיבית מתוך רשומות DB, מעל ברירת המחדל.
 * רשומת DB שערכיה 0 מסירה את המשבצת (אין דרישה).
 */
export function buildRequirementsMap(
  records: StaffingRequirementRecord[] | null | undefined,
): Record<string, FacilityRequirementConfig> {
  const map: Record<string, FacilityRequirementConfig> = {};
  for (const code of Object.keys(STAFFING_REQUIREMENTS)) {
    map[code] = JSON.parse(JSON.stringify(STAFFING_REQUIREMENTS[code]));
  }
  (records || []).forEach((r) => {
    const code = r.facility_code;
    if (!code) return;
    if (!map[code]) map[code] = { weekday: {}, friday: {}, saturday: {} };
    if (!map[code][r.day_group]) map[code][r.day_group] = {};
    if (r.supervisor || r.guard || r.dispatcher) {
      map[code][r.day_group]![r.category] = {
        supervisor: r.supervisor || 0,
        guard: r.guard || 0,
        dispatcher: r.dispatcher || 0,
      };
    } else {
      delete map[code][r.day_group]![r.category];
    }
  });
  return map;
}

export interface FacilityLike {
  code?: string;
  name?: string;
}

/** התאמת תקינה לפי קוד מתקן (עדיפות) או שם מתקן. */
export function getFacilityRequirementConfig(
  facility: FacilityLike | null | undefined,
  requirementsMap?: Record<string, FacilityRequirementConfig>,
): FacilityRequirementConfig | null {
  if (!facility) return null;
  const code = (facility.code || "").trim();
  const name = (facility.name || "").trim();
  const map = requirementsMap || STAFFING_REQUIREMENTS;
  if (map[code]) return map[code];
  if (STAFFING_REQUIREMENTS[name]) return STAFFING_REQUIREMENTS[name];
  return null;
}

export function getRequirement(
  facility: FacilityLike | null | undefined,
  date: Date,
  category: Category,
  requirementsMap?: Record<string, FacilityRequirementConfig>,
): RequirementCounts | null {
  const config = getFacilityRequirementConfig(facility, requirementsMap);
  if (!config) return null;
  const group = getDayGroup(date);
  return config[group]?.[category] || null;
}

export interface StaffMemberLike {
  qualification?: string;
  role?: string;
}

/**
 * היררכיית תפקידים: אחמ"ש (shift_supervisor) יכול למלא כל תפקיד;
 * מאבטח יכול למלא מאבטח או מוקדנית; מוקדנית רק מוקדנית.
 */
export function capabilityOf(staffMember: StaffMemberLike | null | undefined): string {
  if (!staffMember) return "guard";
  if (staffMember.qualification === "shift_supervisor") return "supervisor";
  if (staffMember.role === "guard") return "guard";
  return "dispatcher";
}

export interface AssignmentPoolLike {
  status?: string;
  staff_id?: string;
}

/** בונה בריכת יכולות מתוך רשימת שיבוצים ומפת עובדים (staff_id -> staff). */
export function buildPool(
  assignments: AssignmentPoolLike[] | null | undefined,
  staffMap: Record<string, StaffMemberLike> | undefined,
): Record<string, number> {
  const pool: Record<string, number> = { supervisor: 0, guard: 0, dispatcher: 0 };
  (assignments || [])
    .filter((a) => a && a.status !== "cancelled" && a.staff_id)
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

/**
 * חישוב מחסור על בסיס דרישה ובריכת עובדים לפי יכולת, בהקצאה חמדנית לפי
 * סדר מגבילות יורדת: supervisor (רק אחמ"ש) -> guard (אחמ"ש/מאבטח) -> dispatcher (כולם).
 */
export function computeShortage(
  requirement: RequirementCounts | null | undefined,
  pool: Record<string, number>,
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
      { capability: "supervisor", required: reqSup, shortage: shortSup },
      { capability: "guard", required: reqGuard, shortage: shortGuard },
      { capability: "dispatcher", required: reqDisp, shortage: shortDisp },
    ].filter((d) => d.required > 0),
  };
}

/** טקסט תיאור המחסור (לשימוש בדוחות). */
export function shortageText(shortage: ShortageResult | null | undefined): string {
  if (!shortage) return "";
  const parts: string[] = [];
  if (shortage.shortSup > 0) parts.push(`${shortage.shortSup} ${CAPABILITY_LABELS.supervisor}`);
  if (shortage.shortGuard > 0) parts.push(`${shortage.shortGuard} ${CAPABILITY_LABELS.guard}`);
  if (shortage.shortDisp > 0) parts.push(`${shortage.shortDisp} ${CAPABILITY_LABELS.dispatcher}`);
  return parts.join(", ");
}
