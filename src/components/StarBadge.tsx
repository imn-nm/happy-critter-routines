import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The star count badge (Figma 381:3128), used everywhere a child's stars are
 * shown: lime text on a 10% lime fill with a 1px lime border, radius 14, a
 * 13px ★ and the count in 14px semibold.
 *
 * - As a button (pass onClick) it's 44px tall so it's an easy tap target.
 * - As a label it keeps the Figma's 34px height.
 * - size="lg" is the big version for the young child's picture view.
 */
type StarBadgeProps = {
  /** The number, or a node wrapping it (e.g. an animated count). */
  count: ReactNode;
  size?: "md" | "lg";
  className?: string;
  /** Extra content inside the badge, e.g. floating "+1" bubbles. */
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

const base =
  "inline-flex shrink-0 items-center rounded-[14px] border border-focus-lime bg-focus-lime/10 font-semibold text-focus-lime whitespace-nowrap";

export const StarBadge = forwardRef<HTMLButtonElement, StarBadgeProps>(
  ({ count, size = "md", className, children, onClick, type = "button", ...props }, ref) => {
    const lg = size === "lg";
    const inner = (
      <>
        <span aria-hidden className={lg ? "text-[18px] leading-5" : "text-[13px] leading-4"}>★</span>
        <span className={cn("tabular-nums", lg ? "text-20 leading-6" : "text-[14px] leading-4")}>{count}</span>
        {children}
      </>
    );
    const sizing = lg ? "gap-2 px-4" : "gap-1.5 px-3";
    if (onClick) {
      return (
        <button
          ref={ref}
          type={type}
          onClick={onClick}
          className={cn(
            base,
            sizing,
            lg ? "h-12" : "h-11",
            "transition-colors hover:bg-focus-lime/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender",
            className,
          )}
          {...props}
        >
          {inner}
        </button>
      );
    }
    return (
      <span className={cn(base, sizing, lg ? "h-12" : "py-2", className)} aria-label={props["aria-label"]}>
        {inner}
      </span>
    );
  },
);
StarBadge.displayName = "StarBadge";

export default StarBadge;
