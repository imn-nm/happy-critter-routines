import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ROUND } from "./StreakStar";

/**
 * The Piko device around a round screen: a dark bezel with a soft edge. The
 * screen inside keeps its own size; the bezel adds about 4% on each side.
 */
const RoundDevice = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div
    className={cn("relative aspect-square rounded-full", className)}
    style={{
      background: ROUND.sunken,
      padding: "4.2%",
      boxShadow: `0 0 0 2px ${ROUND.raised}, 0 22px 50px rgba(8,10,20,.45)`,
    }}
  >
    {children}
  </div>
);

export default RoundDevice;
