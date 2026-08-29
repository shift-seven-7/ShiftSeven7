import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Direct port of base44/functions/calculateWeeklyHours/entry.ts - see
// docs/MIGRATION_PLAN.md B.3 for why this stays a synchronous Route Handler
// (fast, read-only aggregate over at most a week of rows) rather than a
// Celery-style background job.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("week_start");
  const facilityId = searchParams.get("facility_id") || undefined;

  if (!weekStart) {
    return NextResponse.json({ error: "week_start is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const weekDates: string[] = [];
  const base = new Date(weekStart + "T12:00:00");
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    weekDates.push(d.toISOString().split("T")[0]);
  }

  let assignmentsQuery = supabase
    .from("shift_assignments")
    .select("staff_id, staff_name, date, actual_start, actual_end, status")
    .gte("date", weekDates[0])
    .lte("date", weekDates[6]);
  if (facilityId) assignmentsQuery = assignmentsQuery.eq("facility_id", facilityId);

  const [{ data: assignments, error: assignmentsError }, { data: staff, error: staffError }, { data: config }] =
    await Promise.all([
      assignmentsQuery,
      supabase.from("staff").select("id, full_name, role"),
      supabase.from("system_config").select("value").eq("key", "max_weekly_hours").maybeSingle(),
    ]);

  if (assignmentsError) return NextResponse.json({ error: assignmentsError.message }, { status: 500 });
  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 });

  const maxHours = parseFloat(config?.value || "60") || 60;
  const active = (assignments || []).filter((a) => a.status !== "cancelled" && a.status !== "no_show");

  interface StaffHours {
    staff_id: string;
    staff_name: string;
    role: string;
    total_hours: number;
    shift_count: number;
    daily_hours: number[];
  }

  const byStaff: Record<string, StaffHours> = {};
  active.forEach((a) => {
    const staffMember = staff?.find((s) => s.id === a.staff_id);
    if (!byStaff[a.staff_id]) {
      byStaff[a.staff_id] = {
        staff_id: a.staff_id,
        staff_name: staffMember?.full_name || a.staff_name,
        role: staffMember?.role || "",
        total_hours: 0,
        shift_count: 0,
        daily_hours: [0, 0, 0, 0, 0, 0, 0],
      };
    }
    const hours = (new Date(a.actual_end).getTime() - new Date(a.actual_start).getTime()) / 3.6e6;
    const dayIndex = weekDates.indexOf(a.date);
    byStaff[a.staff_id].total_hours += hours;
    byStaff[a.staff_id].shift_count += 1;
    if (dayIndex >= 0) byStaff[a.staff_id].daily_hours[dayIndex] += hours;
  });

  const staffHours = Object.values(byStaff)
    .map((h) => ({
      ...h,
      total_hours: Math.round(h.total_hours * 10) / 10,
      daily_hours: h.daily_hours.map((d) => Math.round(d * 10) / 10),
      max_hours: maxHours,
      is_over_limit: h.total_hours > maxHours,
      remaining_hours: Math.round((maxHours - h.total_hours) * 10) / 10,
    }))
    .sort((a, b) => {
      if (a.is_over_limit !== b.is_over_limit) return a.is_over_limit ? -1 : 1;
      return b.total_hours - a.total_hours;
    });

  const violationCount = staffHours.filter((h) => h.is_over_limit).length;
  const totalHoursAll = Math.round(staffHours.reduce((sum, h) => sum + h.total_hours, 0) * 10) / 10;
  const avgHours = staffHours.length > 0 ? Math.round((totalHoursAll / staffHours.length) * 10) / 10 : 0;

  return NextResponse.json({
    week_start: weekStart,
    week_dates: weekDates,
    max_hours: maxHours,
    staff_hours: staffHours,
    violation_count: violationCount,
    total_staff: staffHours.length,
    total_hours_all: totalHoursAll,
    avg_hours: avgHours,
  });
}
