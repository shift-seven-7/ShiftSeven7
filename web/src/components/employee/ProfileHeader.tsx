import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/supabase/database.types";
import { Mail, MapPin, Phone } from "lucide-react";

type Staff = Database["public"]["Tables"]["staff"]["Row"];

const ROLE_LABELS: Record<string, string> = { guard: "מאבטח", dispatcher: "מוקדן" };
const QUAL_LABELS: Record<string, string> = { shift_supervisor: 'אחמ"ש', lead_dispatcher: "אחראית מוקד" };
const STATUS_LABELS: Record<string, string> = { active: "פעיל", on_leave: "בחופשה", inactive: "לא פעיל" };

function initials(name: string | undefined | null) {
  return (
    (name || "")
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("") || "?"
  );
}

export default function ProfileHeader({ staff, facilityName }: { staff: Staff; facilityName: string }) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold shrink-0 mx-auto sm:mx-0">
          {initials(staff.full_name)}
        </div>
        <div className="flex-1 min-w-0 text-center sm:text-right">
          <h2 className="text-lg font-bold">{staff.full_name}</h2>
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5 justify-center sm:justify-start">
            <Badge variant="outline" className="text-xs">
              {ROLE_LABELS[staff.role] || staff.role}
            </Badge>
            {staff.qualification && staff.qualification !== "none" && QUAL_LABELS[staff.qualification] && (
              <Badge variant="secondary" className="text-xs">
                {QUAL_LABELS[staff.qualification]}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground font-mono">#{staff.employee_id}</span>
            <Badge variant={staff.status === "active" ? "default" : "secondary"} className="text-xs">
              {STATUS_LABELS[staff.status] || staff.status}
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground text-center sm:text-right">
          {facilityName && (
            <span className="flex items-center gap-1.5 justify-center sm:justify-start">
              <MapPin className="w-3.5 h-3.5" /> {facilityName}
            </span>
          )}
          {staff.phone && (
            <span className="flex items-center gap-1.5 justify-center sm:justify-start">
              <Phone className="w-3.5 h-3.5" /> {staff.phone}
            </span>
          )}
          {staff.email && (
            <span className="flex items-center gap-1.5 justify-center sm:justify-start">
              <Mail className="w-3.5 h-3.5" /> {staff.email}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
