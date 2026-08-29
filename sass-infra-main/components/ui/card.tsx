import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Card Component
 *
 * Base card container with rounded corners and subtle shadow.
 * Use overflow-hidden when using CardBanner for proper gradient clipping.
 */
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl border bg-card text-card-foreground shadow-card overflow-hidden card-hover",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

/**
 * CardBanner
 *
 * Gradient header section for cards. Supports different gradient variants.
 * Place status badges and main titles here.
 */
type CardBannerVariant = "blue" | "violet" | "success" | "warning" | "error" | "info" | "neutral";

interface CardBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardBannerVariant;
}

const cardBannerVariants: Record<CardBannerVariant, string> = {
  blue: "bg-gradient-to-br from-blue-500 to-blue-600",
  violet: "bg-gradient-to-br from-primary to-purple-500",
  success: "bg-gradient-to-br from-green-500 to-green-600",
  warning: "bg-gradient-to-br from-amber-500 to-amber-600",
  error: "bg-gradient-to-br from-red-500 to-red-600",
  info: "bg-gradient-to-br from-cyan-500 to-cyan-600",
  neutral: "bg-gradient-to-br from-zinc-600 to-zinc-700",
};

const CardBanner = React.forwardRef<HTMLDivElement, CardBannerProps>(
  ({ className, variant = "blue", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "p-4 sm:p-6 text-white",
        cardBannerVariants[variant],
        className,
      )}
      {...props}
    />
  )
);
CardBanner.displayName = "CardBanner";

/**
 * CardHeader
 *
 * Standard header section with flexible layout for titles and descriptions.
 */
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-4 sm:p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

/**
 * CardTitle
 *
 * Main title element for cards.
 */
const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

/**
 * CardDescription
 *
 * Secondary text element, muted styling.
 */
const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

/**
 * CardContent
 *
 * Main content area of the card.
 */
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 pt-0 sm:p-6 sm:pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

/**
 * CardBody
 *
 * Alternative content area with padding on all sides.
 * Use when there's no CardHeader above.
 */
const CardBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 sm:p-6", className)} {...props} />
));
CardBody.displayName = "CardBody";

/**
 * CardFooter
 *
 * Footer section with flex layout.
 */
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-4 pt-0 sm:p-6 sm:pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

/**
 * CardStatBox
 *
 * A stat display box with icon, label, and value.
 * Used in grid layouts within cards.
 */
interface CardStatBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
}

const CardStatBox = React.forwardRef<HTMLDivElement, CardStatBoxProps>(
  ({ className, icon, label, value, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-2 p-4 rounded-xl border border-border/50 bg-card-elevated/30",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-2xl sm:text-3xl font-bold">{value}</span>
    </div>
  )
);
CardStatBox.displayName = "CardStatBox";

/**
 * CardStatsGrid
 *
 * Grid container for CardStatBox components.
 */
const CardStatsGrid = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("grid grid-cols-2 gap-3", className)}
    {...props}
  />
));
CardStatsGrid.displayName = "CardStatsGrid";

/**
 * CardProgress
 *
 * Progress bar with label and percentage value.
 */
interface CardProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: number;
  showPercentage?: boolean;
}

const CardProgress = React.forwardRef<HTMLDivElement, CardProgressProps>(
  ({ className, label, value, showPercentage = true, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-1.5", className)} {...props}>
      <div className="flex justify-between items-center">
        <span className="text-xs sm:text-sm text-muted-foreground">{label}</span>
        {showPercentage && (
          <span className="text-xs sm:text-sm font-medium">{value}%</span>
        )}
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  )
);
CardProgress.displayName = "CardProgress";

/**
 * CardRow
 *
 * A row with icon and text, useful for metadata like dates and locations.
 */
interface CardRowProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
}

const CardRow = React.forwardRef<HTMLDivElement, CardRowProps>(
  ({ className, icon, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center gap-2 text-muted-foreground", className)}
      {...props}
    >
      {icon}
      {children}
    </div>
  )
);
CardRow.displayName = "CardRow";

/**
 * CardBadge
 *
 * Status badge for use within CardBanner or CardHeader.
 */
type CardBadgeVariant = "default" | "success" | "warning" | "error" | "info" | "outline" | "subtle-success" | "subtle-warning" | "subtle-error" | "subtle-info" | "subtle-neutral" | "subtle-blue";

interface CardBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardBadgeVariant;
  icon?: React.ReactNode;
}

const cardBadgeVariants: Record<CardBadgeVariant, string> = {
  default: "bg-white/20 text-white backdrop-blur-sm",
  success: "bg-green-500/90 text-white",
  warning: "bg-amber-500/90 text-white",
  error: "bg-red-500/90 text-white",
  info: "bg-cyan-500/90 text-white",
  outline: "bg-transparent border border-white/30 text-white",
  "subtle-success": "bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/20",
  "subtle-warning": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20",
  "subtle-error": "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20",
  "subtle-info": "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20",
  "subtle-neutral": "bg-muted/50 text-muted-foreground border border-border/50",
  "subtle-blue": "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20",
};

const CardBadge = React.forwardRef<HTMLDivElement, CardBadgeProps>(
  ({ className, variant = "default", icon, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium w-fit",
        cardBadgeVariants[variant],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </div>
  )
);
CardBadge.displayName = "CardBadge";

export {
  Card,
  CardBanner,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  CardBody,
  CardStatBox,
  CardStatsGrid,
  CardProgress,
  CardRow,
  CardBadge,
};
