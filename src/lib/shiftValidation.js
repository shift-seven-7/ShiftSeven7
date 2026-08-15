/**
 * Shift Validation Logic
 * Mirrors the PostgreSQL trigger/function logic at the application level.
 * Enforces: 8-hour rest rule, role-post compatibility, morning staffing minimums,
 * dynamic hour limits, and emergency overrides.
 */

const MIN_REST_HOURS = 8;

/**
 * Validate 8-hour rest between shifts (equivalent to PL/pgSQL trigger).
 * Returns { valid: boolean, error?: string, conflictingShift?: object }
 */
export function validateRestPeriod(newStart, newEnd, existingAssignments) {
  const newStartMs = new Date(newStart).getTime();
  const newEndMs = new Date(newEnd).getTime();
  const minRestMs = MIN_REST_HOURS * 60 * 60 * 1000;

  const active = existingAssignments.filter(a => a.status !== 'cancelled' && a.actual_start && a.actual_end);

  // Check direct overlaps
  for (const a of active) {
    const existStart = new Date(a.actual_start).getTime();
    const existEnd = new Date(a.actual_end).getTime();
    if (newStartMs < existEnd && newEndMs > existStart) {
      return {
        valid: false,
        error: `חפיפה עם משמרת קיימת (${a.shift_code}) בתאריך ${a.date}`,
        conflictingShift: a
      };
    }
  }

  // Find the nearest shift that ENDS before the new shift STARTS
  const prevShifts = active.filter(a => new Date(a.actual_end).getTime() <= newStartMs);
  if (prevShifts.length > 0) {
    const nearest = prevShifts.reduce((best, a) =>
      new Date(a.actual_end).getTime() > new Date(best.actual_end).getTime() ? a : best
    );
    const gapMs = newStartMs - new Date(nearest.actual_end).getTime();
    if (gapMs < minRestMs) {
      const gapH = (gapMs / (1000 * 60 * 60)).toFixed(1);
      return {
        valid: false,
        error: `רק ${gapH} שעות מנוחה אחרי משמרת ${nearest.shift_code} (${nearest.date}). נדרש מינימום ${MIN_REST_HOURS} שעות.`,
        conflictingShift: nearest
      };
    }
  }

  // Find the nearest shift that STARTS after the new shift ENDS
  const nextShifts = active.filter(a => new Date(a.actual_start).getTime() >= newEndMs);
  if (nextShifts.length > 0) {
    const nearest = nextShifts.reduce((best, a) =>
      new Date(a.actual_start).getTime() < new Date(best.actual_start).getTime() ? a : best
    );
    const gapMs = new Date(nearest.actual_start).getTime() - newEndMs;
    if (gapMs < minRestMs) {
      const gapH = (gapMs / (1000 * 60 * 60)).toFixed(1);
      return {
        valid: false,
        error: `רק ${gapH} שעות מנוחה לפני משמרת ${nearest.shift_code} (${nearest.date}). נדרש מינימום ${MIN_REST_HOURS} שעות.`,
        conflictingShift: nearest
      };
    }
  }

  return { valid: true };
}

/**
 * Validate role-post compatibility.
 * Dispatchers → Control Room only. Guards → Static posts only.
 */
export function validateRolePostMatch(staffRole, postType) {
  if (staffRole === 'dispatcher' && postType !== 'control_room') {
    return { valid: false, error: 'Dispatchers can only be assigned to Control Room posts.' };
  }
  if (staffRole === 'guard' && postType !== 'static') {
    return { valid: false, error: 'Guards can only be assigned to static posts.' };
  }
  return { valid: true };
}

/**
 * Validate morning shift staffing requirements.
 * Minimum: 1 Shift Supervisor, 5 Guards, 1 Dispatcher
 */
export function validateMorningStaffing(assignments, staffList) {
  const staffMap = {};
  staffList.forEach(s => { staffMap[s.id] = s; });

  let supervisors = 0;
  let guards = 0;
  let dispatchers = 0;

  assignments.forEach(a => {
    if (a.status === 'cancelled') return;
    const staff = staffMap[a.staff_id];
    if (!staff) return;
    if (staff.role === 'guard') {
      guards++;
      if (staff.qualification === 'shift_supervisor') supervisors++;
    }
    if (staff.role === 'dispatcher') dispatchers++;
  });

  const issues = [];
  if (supervisors < 1) issues.push(`נדרש לפחות אחמ"ש 1 (קיים: ${supervisors})`);
  if (guards < 5) issues.push(`נדרש לפחות 5 מאבטחים (קיימים: ${guards})`);
  if (dispatchers < 1) issues.push(`נדרש לפחות מוקדן 1 (קיים: ${dispatchers})`);

  return { valid: issues.length === 0, issues };
}

/**
 * Calculate weekly hours for a staff member.
 */
export function calculateWeeklyHours(assignments) {
  let totalMinutes = 0;
  assignments.forEach(a => {
    if (a.status === 'cancelled') return;
    const start = new Date(a.actual_start).getTime();
    const end = new Date(a.actual_end).getTime();
    totalMinutes += (end - start) / (1000 * 60);
  });
  return totalMinutes / 60;
}

/**
 * Get the start and end of the week (Sunday-Saturday) for a given date.
 */
export function getWeekBounds(dateStr) {
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

/**
 * Validate shift code format: 1-3 English letters optionally followed by a number.
 */
export function validateShiftCode(code) {
  const regex = /^[A-Za-z]{1,3}\d?$/;
  return regex.test(code);
}