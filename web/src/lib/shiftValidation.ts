/**
 * Shift Validation Logic
 * Ported from the old app's src/lib/shiftValidation.js (Base44 era), which
 * itself mirrored PL/pgSQL trigger logic. Enforces: 8-hour rest rule,
 * role-post compatibility, morning staffing minimums, weekly hours.
 */

export interface AssignmentLike {
  status?: string;
  actual_start?: string;
  actual_end?: string;
  shift_code?: string;
  date?: string;
  staff_id?: string;
}

export interface StaffLike {
  id: string;
  role?: string;
  qualification?: string;
}

const MIN_REST_HOURS = 8;

export interface RestValidationResult {
  valid: boolean;
  error?: string;
  conflictingShift?: AssignmentLike;
}

/** Validate 8-hour rest between shifts. */
export function validateRestPeriod(
  newStart: string,
  newEnd: string,
  existingAssignments: AssignmentLike[],
): RestValidationResult {
  const newStartMs = new Date(newStart).getTime();
  const newEndMs = new Date(newEnd).getTime();
  const minRestMs = MIN_REST_HOURS * 60 * 60 * 1000;

  const active = existingAssignments.filter(
    (a) => a.status !== "cancelled" && a.actual_start && a.actual_end,
  );

  for (const a of active) {
    const existStart = new Date(a.actual_start!).getTime();
    const existEnd = new Date(a.actual_end!).getTime();
    if (newStartMs < existEnd && newEndMs > existStart) {
      return {
        valid: false,
        error: `חפיפה עם משמרת קיימת (${a.shift_code}) בתאריך ${a.date}`,
        conflictingShift: a,
      };
    }
  }

  const prevShifts = active.filter((a) => new Date(a.actual_end!).getTime() <= newStartMs);
  if (prevShifts.length > 0) {
    const nearest = prevShifts.reduce((best, a) =>
      new Date(a.actual_end!).getTime() > new Date(best.actual_end!).getTime() ? a : best,
    );
    const gapMs = newStartMs - new Date(nearest.actual_end!).getTime();
    if (gapMs < minRestMs) {
      const gapH = (gapMs / (1000 * 60 * 60)).toFixed(1);
      return {
        valid: false,
        error: `רק ${gapH} שעות מנוחה אחרי משמרת ${nearest.shift_code} (${nearest.date}). נדרש מינימום ${MIN_REST_HOURS} שעות.`,
        conflictingShift: nearest,
      };
    }
  }

  const nextShifts = active.filter((a) => new Date(a.actual_start!).getTime() >= newEndMs);
  if (nextShifts.length > 0) {
    const nearest = nextShifts.reduce((best, a) =>
      new Date(a.actual_start!).getTime() < new Date(best.actual_start!).getTime() ? a : best,
    );
    const gapMs = new Date(nearest.actual_start!).getTime() - newEndMs;
    if (gapMs < minRestMs) {
      const gapH = (gapMs / (1000 * 60 * 60)).toFixed(1);
      return {
        valid: false,
        error: `רק ${gapH} שעות מנוחה לפני משמרת ${nearest.shift_code} (${nearest.date}). נדרש מינימום ${MIN_REST_HOURS} שעות.`,
        conflictingShift: nearest,
      };
    }
  }

  return { valid: true };
}

/** Dispatchers -> Control Room only. Guards -> static posts only. */
export function validateRolePostMatch(
  staffRole: string,
  postType: string,
): { valid: boolean; error?: string } {
  if (staffRole === "dispatcher" && postType !== "control_room") {
    return { valid: false, error: "Dispatchers can only be assigned to Control Room posts." };
  }
  if (staffRole === "guard" && postType !== "static") {
    return { valid: false, error: "Guards can only be assigned to static posts." };
  }
  return { valid: true };
}

/** Minimum morning staffing: 1 shift supervisor, 5 guards, 1 dispatcher. */
export function validateMorningStaffing(
  assignments: AssignmentLike[],
  staffList: StaffLike[],
): { valid: boolean; issues: string[] } {
  const staffMap: Record<string, StaffLike> = {};
  staffList.forEach((s) => {
    staffMap[s.id] = s;
  });

  let supervisors = 0;
  let guards = 0;
  let dispatchers = 0;

  assignments.forEach((a) => {
    if (a.status === "cancelled" || !a.staff_id) return;
    const staff = staffMap[a.staff_id];
    if (!staff) return;
    if (staff.role === "guard") {
      guards++;
      if (staff.qualification === "shift_supervisor") supervisors++;
    }
    if (staff.role === "dispatcher") dispatchers++;
  });

  const issues: string[] = [];
  if (supervisors < 1) issues.push(`נדרש לפחות אחמ"ש 1 (קיים: ${supervisors})`);
  if (guards < 5) issues.push(`נדרש לפחות 5 מאבטחים (קיימים: ${guards})`);
  if (dispatchers < 1) issues.push(`נדרש לפחות מוקדן 1 (קיים: ${dispatchers})`);

  return { valid: issues.length === 0, issues };
}

/** Total hours across a set of (non-cancelled) assignments. */
export function calculateWeeklyHours(assignments: AssignmentLike[]): number {
  let totalMinutes = 0;
  assignments.forEach((a) => {
    if (a.status === "cancelled" || !a.actual_start || !a.actual_end) return;
    const start = new Date(a.actual_start).getTime();
    const end = new Date(a.actual_end).getTime();
    totalMinutes += (end - start) / (1000 * 60);
  });
  return totalMinutes / 60;
}

/** Sunday-Saturday bounds for the week containing dateStr. */
export function getWeekBounds(dateStr: string): { weekStart: Date; weekEnd: Date } {
  const d = new Date(dateStr);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { weekStart: start, weekEnd: end };
}

/** 1-3 English letters optionally followed by a number. */
export function validateShiftCode(code: string): boolean {
  return /^[A-Za-z]{1,3}\d?$/.test(code);
}
