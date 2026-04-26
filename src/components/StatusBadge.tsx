import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatusVariant = "time" | "overdue" | "complete" | "info";

interface StatusBadgeProps {
  variant?: StatusVariant;
  children: ReactNode;
  className?: string;
}

/**
 * StatusBadge — outline pill used for task status (time remaining,
 * overdue, complete, info). Matches the Figma component set:
 *   State=Time     → mint-500  @ 40% stroke
 *   State=Overdue  → coral-400 @ 22% stroke
 *   State=Complete → mint-500  @ 100% stroke
 *   State=Info     → iris-400  @ 30% stroke
 *
 * Padding 6 × 12, gap 6, radius pill, 2px stroke.
 * Label text: Inter Medium 12, color fog-50.
 */
export default function StatusBadge({
  variant = "time",
  children,
  className,
}: StatusBadgeProps) {
  // Stroke opacities pulled from Figma StatusBadge component (107:47):
  //   Time      → mint-500 @ 40%
  //   Overdue   → coral-400 @ 22%
  //   Complete  → mint-500 @ 100%
  //   Info      → iris-400 @ 30%
  const stroke = {
    time:     "border-mint-500/40",
    overdue:  "border-coral-400/[0.22]",
    complete: "border-mint-500",
    info:     "border-iris-400/30",
  }[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded-pill border-2 bg-transparent",
        stroke,
        className,
      )}
    >
      <span className="text-12 font-medium text-fog-50 leading-none">
        {children}
      </span>
    </span>
  );
}
