import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import EmployeeRequestForm from "../components/EmployeeRequestForm";
import EmployeeRequestList from "../components/EmployeeRequestList";
import { useImpersonation } from "@/lib/ImpersonationContext";

export default function EmployeeRequestsPage() {
  const qc = useQueryClient();
  const { effectiveStaff: myStaff } = useImpersonation();

  const { data: myRequests = [], isLoading } = useQuery({
    queryKey: ["employee-requests-mine", myStaff?.id],
    queryFn: () => base44.entities.EmployeeRequest.filter({ staff_id: myStaff.id }, "-created_date", 50),
    enabled: !!myStaff?.id,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["employee-requests-mine"] });

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto" dir="rtl">
      <PageHeader title="הבקשות שלי" description="הגשת בקשות חופשה, מילואים, מחלה ועוד — ומעקב אחר סטטוס" />

      {!myStaff ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          אין לך רשומת עובד משויכת במערכת. פנה למנהל המערכת.
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-4">הגשת בקשה חדשה</h2>
            <EmployeeRequestForm staff={myStaff} onSubmitted={refresh} />
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-4">הבקשות שלי ({myRequests.length})</h2>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-4 border-border border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <EmployeeRequestList requests={myRequests} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}