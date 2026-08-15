// תקינת ברירת מחדל (מקור היסטורי). משמשת כברירת מחדל כאשר אין רשומת DB עבור משבצת,
// וכן לאיתחול הערכים בממשק הניהול. עריכות המשתמש נשמרות בישות StaffingRequirement
// וגוברות על ברירת המחדל.
export const STAFFING_REQUIREMENTS = {
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

export const CATEGORY_LABELS = { morning: "בוקר", afternoon: "צהריים", night: "לילה" };
export const CATEGORY_ORDER = ["morning", "afternoon", "night"];
export const CAPABILITY_LABELS = { supervisor: 'אחמ"ש', guard: "מאבטח", dispatcher: "מוקדנית" };

export const DAY_GROUPS = [
  { key: "weekday", label: "א׳–ה׳" },
  { key: "friday", label: "שישי" },
  { key: "saturday", label: "שבת" },
];

export function getDayGroup(date) {
  const day = date.getDay();
  if (day === 5) return "friday";
  if (day === 6) return "saturday";
  return "weekday";
}

// בונה מפת תקינה אפקטיבית מתוך רשומות DB, מעל ברירת המחדל.
// מחזיר מבנה: { [facilityCode]: { weekday: { morning: {supervisor,guard,dispatcher}, ... }, friday, saturday } }
// רשומת DB שערכיה 0 מסירה את המשבצת (אין דרישה).
export function buildRequirementsMap(records) {
  const map = {};
  for (const code of Object.keys(STAFFING_REQUIREMENTS)) {
    map[code] = JSON.parse(JSON.stringify(STAFFING_REQUIREMENTS[code]));
  }
  (records || []).forEach((r) => {
    const code = r.facility_code;
    if (!code) return;
    if (!map[code]) map[code] = { weekday: {}, friday: {}, saturday: {} };
    if (!map[code][r.day_group]) map[code][r.day_group] = {};
    if (r.supervisor || r.guard || r.dispatcher) {
      map[code][r.day_group][r.category] = {
        supervisor: r.supervisor || 0,
        guard: r.guard || 0,
        dispatcher: r.dispatcher || 0,
      };
    } else {
      delete map[code][r.day_group][r.category];
    }
  });
  return map;
}

// התאמת תקינה לפי קוד מתקן (עדיפות) או שם מתקן. requirementsMap אופציונלי (מ-DB).
export function getFacilityRequirementConfig(facility, requirementsMap) {
  if (!facility) return null;
  const code = (facility.code || "").trim();
  const name = (facility.name || "").trim();
  const map = requirementsMap || STAFFING_REQUIREMENTS;
  if (map[code]) return map[code];
  if (STAFFING_REQUIREMENTS[name]) return STAFFING_REQUIREMENTS[name];
  return null;
}

export function getRequirement(facility, date, category, requirementsMap) {
  const config = getFacilityRequirementConfig(facility, requirementsMap);
  if (!config) return null;
  const group = getDayGroup(date);
  return config[group]?.[category] || null;
}

// היררכיית תפקידים:
// אחמ"ש (shift_supervisor) יכול למלא כל תפקיד; מאבטח יכול למלא מאבטח או מוקדנית; מוקדנית רק מוקדנית.
export function capabilityOf(staffMember) {
  if (!staffMember) return "guard";
  if (staffMember.qualification === "shift_supervisor") return "supervisor";
  if (staffMember.role === "guard") return "guard";
  return "dispatcher";
}

// בונה בריכת יכולות מתוך רשימת שיבוצים ומפת עובדים (staff_id -> staff).
export function buildPool(assignments, staffMap) {
  const pool = { supervisor: 0, guard: 0, dispatcher: 0 };
  (assignments || [])
    .filter((a) => a && a.status !== "cancelled" && a.staff_id)
    .forEach((a) => {
      const cap = capabilityOf(staffMap?.[a.staff_id]);
      pool[cap] = (pool[cap] || 0) + 1;
    });
  return pool;
}

// חישוב מחסור על בסיס דרישה ובריכת עובדים לפי יכולת, בהקצאה חמדנית לפי סדר מגבילות יורדת:
// supervisor (רק אחמ"ש) -> guard (אחמ"ש/מאבטח) -> dispatcher (כולם).
export function computeShortage(requirement, pool) {
  const req = requirement || {};
  let sup = pool.supervisor || 0;
  let grd = pool.guard || 0;
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

// טקסט תיאור המחסור (לשימוש בדוחות).
export function shortageText(shortage) {
  if (!shortage) return "";
  const parts = [];
  if (shortage.shortSup > 0) parts.push(`${shortage.shortSup} ${CAPABILITY_LABELS.supervisor}`);
  if (shortage.shortGuard > 0) parts.push(`${shortage.shortGuard} ${CAPABILITY_LABELS.guard}`);
  if (shortage.shortDisp > 0) parts.push(`${shortage.shortDisp} ${CAPABILITY_LABELS.dispatcher}`);
  return parts.join(", ");
}