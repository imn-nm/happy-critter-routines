import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatusVariant = "time" | "overdue" | "complete" | "info";

interface StatusBadgeProps {
  variant?: StatusVariant;
  children: ReactNode;
  className?: string;
}

/**
 * StatusBadge — outline pill used for task status on the child screen
 * (time, overdue, complete, info). Figma "Child / Focus — redesigned":
 *   Time     (StatusBadge 336:437) → 2px focus-mint stroke, Inter Medium 12 focus-text
 *   Overdue  (Child Badge 336:444) → focus-pink @ 16% fill, 2px focus-alert
 *                                     stroke, Inter Regular 14 focus-pink
 *   Complete → focus-mint stroke + faint mint fill
 *   Info     → focus-lavender stroke
 * Padding 6 × 12, radius pill.
 */
export default function StatusBadge({
  variant = "time",
  children,
  className,
}: StatusBadgeProps) {
  const tone = {
    time:     "border-focus-mint text-focus-text text-12 font-medium",
    overdue:  "border-focus-alert bg-focus-pink/15 text-focus-pink text-14 font-normal",
    complete: "border-focus-mint bg-focus-mint/15 text-focus-text text-12 font-medium",
    info:     "border-focus-lavender text-focus-text text-12 font-medium",
  }[variant];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 px-3 py-1.5 rounded-pill border-2 leading-none whitespace-nowrap",
        tone,
        className,
      )}
    >
      {children}
    </span>
  );
}
