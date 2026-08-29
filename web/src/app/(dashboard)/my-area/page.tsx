"use client";

import CredentialsReminders from "@/components/employee/CredentialsReminders";
import MonthlyHoursChart from "@/components/employee/MonthlyHoursChart";
import ProfileHeader from "@/components/employee/ProfileHeader";
import UpcomingShifts from "@/components/employee/UpcomingShifts";
import PageHeader from "@/components/PageHeader";
import { useImpersonation } from "@/lib/impersonation-context";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export default function MyAreaPage() {
  const { effectiveStaff: myStaff } = useImpersonation();
  const { data: facilities = [] } = useQuery({
    queryKey: ["facilities"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("facilities").select("*");
      if (error) throw error;
      return data;
    },
  });
  const facilityName = useMemo(
    () => (myStaff ? facilities.find((f) => f.id === myStaff.primary_facility)?.name || "" : ""),
    [myStaff, facilities],
  );

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto" dir="rtl">
      <PageHeader title="האזור שלי" description={`ברוך הבא${myStaff?.full_name ? `, ${myStaff.full_name}` : ""} — סיכום השעות והתוקפים שלך`} />

      {!myStaff ? (
        <div className="text-center py-16 text-sm text-muted-foreground">אין לך רשומת עובד משויכת במערכת. פנה למנהל המערכת.</div>
      ) : (
        <div className="grid gap-6">
          <ProfileHeader staff={myStaff} facilityName={facilityName} />
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="grid gap-6">
              <UpcomingShifts staffId={myStaff.id} />
              <CredentialsReminders staff={myStaff} />
            </div>
            <MonthlyHoursChart staffId={myStaff.id} />
          </div>
        </div>
      )}
    </div>
  );
}
