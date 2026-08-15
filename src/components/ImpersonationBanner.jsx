import { useNavigate } from "react-router-dom";
import { useImpersonation } from "@/lib/ImpersonationContext";
import { Button } from "@/components/ui/button";
import { UserCog, RotateCcw } from "lucide-react";

export default function ImpersonationBanner() {
  const { isImpersonating, effectiveStaff, clearImpersonation } = useImpersonation();
  const navigate = useNavigate();
  if (!isImpersonating) return null;
  return (
    <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 flex items-center justify-between gap-3 text-amber-900">
      <div className="flex items-center gap-2 text-sm font-medium">
        <UserCog className="w-4 h-4 shrink-0" />
        <span>מצב בדיקה — צופה כעובד: {effectiveStaff?.full_name}</span>
      </div>
      <Button
        size="sm"
        className="h-7 gap-1.5 text-xs bg-amber-900 hover:bg-amber-900/90"
        onClick={() => { clearImpersonation(); navigate("/"); }}
      >
        <RotateCcw className="w-3.5 h-3.5" />
        חזור למנהל
      </Button>
    </div>
  );
}