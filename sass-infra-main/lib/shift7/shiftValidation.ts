// Ported unchanged from the old app's lib/shiftValidation.ts — pure logic,
// no Supabase/React dependency. Used by smart-schedule (rest-period check
// before creating an assignment via drag-and-drop).

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
  existingAssignments: AssignmentLike[]
): RestValidationResult {
  const newStartMs = new Date(newStart).getTime();
  const newEndMs = new Date(newEnd).getTime();
  const minRestMs = MIN_REST_HOURS * 60 * 60 * 1000;

  const active = existingAssignments.filter(
    (a) => a.status !== 'cancelled' && a.actual_start && a.actual_end
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
      new Date(a.actual_end!).getTime() > new Date(best.actual_end!).getTime() ? a : best
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
      new Date(a.actual_start!).getTime() < new Date(best.actual_start!).getTime() ? a : best
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
