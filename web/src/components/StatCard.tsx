import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

const TONES: Record<string, string> = {
  slate: "bg-accent text-accent-foreground",
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  purple: "bg-purple-50 text-purple-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
};

export default function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  tone = "slate",
  to,
  loading,
  className,
  iconClassName,
}: {
  icon?: LucideIcon;
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  tone?: keyof typeof TONES;
  to?: string;
  loading?: boolean;
  className?: string;
  iconClassName?: string;
}) {
  const content = (
    <div className="flex items-start justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
          {label}
        </p>
        {loading ? (
          <Skeleton className="h-7 w-14 mt-2" />
        ) : (
          <p className="text-2xl font-bold mt-1.5 tabular-nums">{value}</p>
        )}
        {loading ? (
          <Skeleton className="h-3 w-20 mt-2" />
        ) : (
          sublabel && <p className="text-xs text-muted-foreground mt-1 truncate">{sublabel}</p>
        )}
      </div>
      {Icon && (
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            TONES[tone] || TONES.slate,
            iconClassName,
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
      )}
    </div>
  );

  const cardClass = cn(
    "bg-card border border-border rounded-xl p-5 transition-all",
    to && !loading ? "hover:shadow-md hover:border-primary/30" : "hover:shadow-md",
    className,
  );

  if (to && !loading) {
    return (
      <Link href={to} className={cardClass}>
        {content}
      </Link>
    );
  }

  return <div className={cardClass}>{content}</div>;
}
