import { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { CalendarDays, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const HEB_MONTHS = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MonthlyHoursChart({ staffId }) {
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["my-assignments", staffId],
    queryFn: () => base44.entities.ShiftAssignment.filter({ staff_id: staffId }, "-date", 500),
    enabled: !!staffId,
  });

  const { months, currentHours, currentShifts, delta } = useMemo(() => {
    const now = new Date();
    const buckets = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: monthKey(d), label: HEB_MONTHS[d.getMonth()], hours: 0, shifts: 0 });
    }
    const map = {};
    buckets.forEach(b => { map[b.key] = b; });

    assignments
      .filter(a => a.status !== "cancelled" && a.status !== "no_show" && a.actual_start && a.actual_end)
      .forEach(a => {
        const k = monthKey(new Date(a.actual_start));
        if (map[k]) {
          map[k].hours += (new Date(a.actual_end) - new Date(a.actual_start)) / (1000 * 60 * 60);
          map[k].shifts += 1;
        }
      });
    buckets.forEach(b => { b.hours = Math.round(b.hours * 10) / 10; });

    const cur = buckets[buckets.length - 1];
    const prev = buckets[buckets.length - 2];
    const delta = prev ? Math.round((cur.hours - prev.hours) * 10) / 10 : 0;
    return { months: buckets, currentHours: cur.hours, currentShifts: cur.shifts, delta };
  }, [assignments]);

  const deltaUp = delta > 0;
  const deltaDown = delta < 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">שעות עבודה חודשיות</h2>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <p className="text-[11px] text-muted-foreground">שעות החודש</p>
              <p className="text-xl font-bold tabular-nums">{currentHours}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <p className="text-[11px] text-muted-foreground">משמרות החודש</p>
              <p className="text-xl font-bold tabular-nums">{currentShifts}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <p className="text-[11px] text-muted-foreground">לעומת חודש שעבר</p>
              <p className={cn("text-xl font-bold tabular-nums flex items-center justify-center gap-1",
                deltaUp ? "text-green-600" : deltaDown ? "text-red-600" : "text-muted-foreground")}>
                {deltaUp ? <TrendingUp className="w-4 h-4" /> : deltaDown ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                {delta > 0 ? "+" : ""}{delta}
              </p>
            </div>
          </div>

          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12, background: "hsl(var(--popover))" }}
                  formatter={(v) => [`${v} שע׳`, "שעות"]}
                />
                <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                  {months.map((m, i) => (
                    <Cell key={i} fill={i === months.length - 1 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.3)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}