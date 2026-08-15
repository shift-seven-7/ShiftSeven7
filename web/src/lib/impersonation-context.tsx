"use client";

// Ported from the old app's src/lib/ImpersonationContext.jsx. Lets an admin
// preview the app as if they were a given employee. This is a UI lens only -
// the admin's real session (and its RLS-visible data) is unchanged; RLS is
// the actual security boundary (see docs/MIGRATION_PLAN.md B.3), so
// impersonation never grants access the admin's own session didn't already
// have.
import { createClient } from "@/lib/supabase/client";
import type { AccessLevel } from "@/lib/routePermissions";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "ss_impersonation_staff_id";

export interface StaffRow {
  id: string;
  user_id: string | null;
  full_name: string;
  employee_id: string;
  role: string;
  qualification: string;
  access_level: AccessLevel;
  email: string | null;
  primary_facility: string;
}

interface ImpersonationContextValue {
  staffList: StaffRow[];
  staffListLoaded: boolean;
  realStaff: StaffRow | null | undefined;
  impersonatedStaff: StaffRow | null | undefined;
  isAdmin: boolean;
  isImpersonating: boolean;
  effectiveStaff: StaffRow | null | undefined;
  effectiveAccessLevel: AccessLevel | null;
  setImpersonation: (id: string | null) => void;
  clearImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextValue | null>(null);

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [userRole, setUserRole] = useState<AccessLevel | null>(null);
  const [impersonatedStaffId, setImpersonatedStaffId] = useState<string | null>(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getClaims().then(({ data }) => {
      setUserId(data?.claims?.sub ?? null);
      setUserRole((data?.claims?.user_role as AccessLevel) ?? null);
    });
  }, []);

  const { data: staffList = [], isSuccess: staffListLoaded } = useQuery({
    queryKey: ["staff-list-for-impersonation", userId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("staff")
        .select("id, user_id, full_name, employee_id, role, qualification, access_level, email, primary_facility");
      if (error) throw error;
      return data as StaffRow[];
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (userId === null) {
      // Reset impersonation whenever the real session goes away (logout).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImpersonatedStaffId(null);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }, [userId]);

  const clearImpersonation = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setImpersonatedStaffId(null);
  };

  const setImpersonation = (id: string | null) => {
    if (id) {
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {}
      setImpersonatedStaffId(id);
    } else {
      clearImpersonation();
    }
  };

  const isAdmin = userRole === "admin";
  const realStaff = useMemo(
    () => (userId ? staffList.find((s) => s.user_id === userId) : null),
    [userId, staffList],
  );
  const impersonatedStaff = useMemo(
    () => (impersonatedStaffId ? staffList.find((s) => s.id === impersonatedStaffId) : null),
    [impersonatedStaffId, staffList],
  );
  const isImpersonating = !!impersonatedStaffId && isAdmin;
  const effectiveStaff = isImpersonating ? impersonatedStaff : realStaff;

  const needsStaffList = isImpersonating || !isAdmin;
  const effectiveAccessLevel: AccessLevel | null =
    userId === undefined || (needsStaffList && !staffListLoaded)
      ? null
      : isImpersonating
        ? impersonatedStaff?.access_level || "employee"
        : isAdmin
          ? "admin"
          : realStaff
            ? realStaff.access_level || "employee"
            : "no_access";

  return (
    <ImpersonationContext.Provider
      value={{
        staffList,
        staffListLoaded,
        realStaff,
        impersonatedStaff,
        isAdmin,
        isImpersonating,
        effectiveStaff,
        effectiveAccessLevel,
        setImpersonation,
        clearImpersonation,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error("useImpersonation must be used within ImpersonationProvider");
  return ctx;
}
