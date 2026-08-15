import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const weekStart = body.week_start;
    const facilityId = body.facility_id || '';

    if (!weekStart) {
      return Response.json({ error: 'week_start is required' }, { status: 400 });
    }

    // Compute the 7 date strings for the week
    const start = new Date(weekStart + 'T12:00:00');
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      weekDates.push(
        d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0')
      );
    }

    // Fetch all assignments for the week (filter by facility if provided)
    let assignments = [];
    if (facilityId) {
      const results = await Promise.all(
        weekDates.map(date =>
          base44.asServiceRole.entities.ShiftAssignment.filter({ date, facility_id: facilityId })
        )
      );
      assignments = results.flat();
    } else {
      const results = await Promise.all(
        weekDates.map(date =>
          base44.asServiceRole.entities.ShiftAssignment.filter({ date })
        )
      );
      assignments = results.flat();
    }

    // Only count active shifts (not cancelled / no_show)
    const active = assignments.filter(a => a.status !== 'cancelled' && a.status !== 'no_show');

    // Fetch staff and config
    const staff = await base44.asServiceRole.entities.Staff.list();
    const configEntries = await base44.asServiceRole.entities.SystemConfig.filter({ key: 'max_weekly_hours' });
    const maxHours = parseFloat(configEntries[0]?.value || '60');

    // Sum hours per staff
    const hoursMap = {};
    active.forEach(a => {
      const startMs = new Date(a.actual_start).getTime();
      const endMs = new Date(a.actual_end).getTime();
      const hours = (endMs - startMs) / (1000 * 60 * 60);
      if (!hoursMap[a.staff_id]) {
        const s = staff.find(x => x.id === a.staff_id);
        hoursMap[a.staff_id] = {
          staff_id: a.staff_id,
          staff_name: s?.full_name || a.staff_name,
          role: s?.role || '',
          total_hours: 0,
          shift_count: 0,
          daily_hours: [0, 0, 0, 0, 0, 0, 0],
        };
      }
      hoursMap[a.staff_id].total_hours += hours;
      hoursMap[a.staff_id].shift_count += 1;
      const dayIdx = weekDates.indexOf(a.date);
      if (dayIdx >= 0) hoursMap[a.staff_id].daily_hours[dayIdx] += hours;
    });

    // Round and flag violations
    const result = Object.values(hoursMap).map(h => ({
      ...h,
      total_hours: Math.round(h.total_hours * 10) / 10,
      daily_hours: h.daily_hours.map(d => Math.round(d * 10) / 10),
      max_hours: maxHours,
      is_over_limit: h.total_hours > maxHours,
      remaining_hours: Math.round((maxHours - h.total_hours) * 10) / 10,
    }));

    // Sort: violations first, then by hours descending
    result.sort((a, b) => {
      if (a.is_over_limit !== b.is_over_limit) return a.is_over_limit ? -1 : 1;
      return b.total_hours - a.total_hours;
    });

    return Response.json({
      week_start: weekStart,
      week_dates: weekDates,
      max_hours: maxHours,
      staff_hours: result,
      violation_count: result.filter(r => r.is_over_limit).length,
      total_staff: result.length,
      total_hours_all: Math.round(result.reduce((sum, r) => sum + r.total_hours, 0) * 10) / 10,
      avg_hours: result.length > 0 ? Math.round((result.reduce((sum, r) => sum + r.total_hours, 0) / result.length) * 10) / 10 : 0,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});