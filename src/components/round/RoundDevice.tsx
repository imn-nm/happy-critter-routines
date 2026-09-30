import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PIKO } from "./StreakStar";

/**
 * The Piko device around a round screen: a dark bezel with a soft edge, as
 * in the brand book. The screen inside keeps its own size; the bezel adds
 * about 4% on each side.
 */
const RoundDevice = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div
    className={cn("relative aspect-square rounded-full", className)}
    style={{
      background: PIKO.abyss,
      padding: "4.2%",
      boxShadow: `0 0 0 2px ${PIKO.raised}, 0 22px 50px rgba(8,10,20,.45)`,
    }}
  >
    {children}
  </div>
);

export default RoundDevice;
