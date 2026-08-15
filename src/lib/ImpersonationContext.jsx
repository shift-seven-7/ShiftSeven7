import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

const ImpersonationContext = createContext(null);
const STORAGE_KEY = "ss_impersonation_staff_id";

export const ImpersonationProvider = ({ children }) => {
  const { user } = useAuth();
  const [staffList, setStaffList] = useState([]);
  const [staffListLoaded, setStaffListLoaded] = useState(false);
  const [impersonatedStaffId, setImpersonatedStaffId] = useState(
    () => (typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null)
  );

  useEffect(() => {
    if (!user) return;
    base44.entities.Staff.list()
      .then((list) => { setStaffList(list); setStaffListLoaded(true); })
      .catch(() => { setStaffListLoaded(true); });
  }, [user]);

  // Reset impersonation whenever the real user changes (logout / switch account)
  useEffect(() => {
    if (!user) {
      setImpersonatedStaffId(null);
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    }
  }, [user]);

  const clearImpersonation = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    setImpersonatedStaffId(null);
  };

  const setImpersonation = (id) => {
    if (id) {
      try { localStorage.setItem(STORAGE_KEY, id); } catch (e) {}
      setImpersonatedStaffId(id);
    } else {
      clearImpersonation();
    }
  };

  const isAdmin = user?.role === "admin";
  const realStaff = useMemo(
    () => (user ? staffList.find((s) => s.email === user.email) : null),
    [user, staffList]
  );
  const impersonatedStaff = useMemo(
    () => (impersonatedStaffId ? staffList.find((s) => s.id === impersonatedStaffId) : null),
    [impersonatedStaffId, staffList]
  );
  const isImpersonating = !!impersonatedStaffId && isAdmin;
  const effectiveStaff = isImpersonating ? impersonatedStaff : realStaff;

  // A staff lookup is needed for anyone except a real (non-impersonating) admin.
  // Until that lookup resolves, report null so consumers can show a loading state
  // instead of momentarily treating the user as unauthorized.
  const needsStaffList = isImpersonating || user?.role !== "admin";
  const effectiveAccessLevel =
    needsStaffList && !staffListLoaded
      ? null
      : isImpersonating
      ? impersonatedStaff?.access_level || "employee"
      : user?.role === "admin"
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
};

export const useImpersonation = () => {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error("useImpersonation must be used within ImpersonationProvider");
  return ctx;
};