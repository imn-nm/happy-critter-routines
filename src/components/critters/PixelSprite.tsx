import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { PixelModel } from "./pixelModel";

export type CritterMood = "none" | "idle" | "happy" | "excited" | "celebrate" | "worried" | "sleep";

interface PixelSpriteProps {
  model: PixelModel;
  size?: number;
  /** Shorthand for animated idle motion; ignored when `mood` is set. */
  animated?: boolean;
  mood?: CritterMood;
  className?: string;
}

const MOOD_CLASS: Record<CritterMood, string> = {
  none: "",
  idle: "critter-idle",
  happy: "critter-happy",
  excited: "critter-excited",
  celebrate: "critter-celebrate",
  worried: "critter-worried",
  sleep: "critter-sleep",
};

/** Renders a flat pixel-art critter as a crisp SVG sprite with mood animation. */
const PixelSprite = ({ model, size = 160, animated = false, mood, className }: PixelSpriteProps) => {
  const { cells, viewBox } = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of model.cells) {
      minX = Math.min(minX, c.x);
      maxX = Math.max(maxX, c.x + 1);
      minY = Math.min(minY, c.y);
      maxY = Math.max(maxY, c.y + 1);
    }
    return {
      cells: model.cells,
      viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
    };
  }, [model]);

  const effectiveMood: CritterMood = mood ?? (animated ? "idle" : "none");

  return (
    <div className={cn("inline-block", className)} style={{ width: size, height: size }}>
      <style>{`
        @keyframes critter-idle { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-2.5%) scale(1.015); } }
        @keyframes critter-happy { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7%); } }
        @keyframes critter-excited { 0%,100% { transform: translateY(0) rotate(-2deg); } 25% { transform: translateY(-9%) rotate(2deg); } 50% { transform: translateY(0) rotate(-2deg); } 75% { transform: translateY(-5%) rotate(2deg); } }
        @keyframes critter-celebrate { 0% { transform: translateY(0) scale(1); } 30% { transform: translateY(-14%) scale(1.06); } 55% { transform: translateY(0) scale(1); } 70% { transform: translateY(-6%) scale(1.03); } 100% { transform: translateY(0) scale(1); } }
        @keyframes critter-worried { 0%,100% { transform: rotate(0deg); } 20% { transform: rotate(-4deg); } 40% { transform: rotate(4deg); } 60% { transform: rotate(-3deg); } 80% { transform: rotate(2deg); } }
        @keyframes critter-sleep { 0%,100% { transform: scale(1); } 50% { transform: scale(1.03); } }
        .critter-idle { animation: critter-idle 2.4s ease-in-out infinite; }
        .critter-happy { animation: critter-happy 0.9s ease-in-out infinite; }
        .critter-excited { animation: critter-excited 0.7s ease-in-out infinite; }
        .critter-celebrate { animation: critter-celebrate 0.9s ease-in-out infinite; }
        .critter-worried { animation: critter-worried 0.6s ease-in-out infinite; }
        .critter-sleep { animation: critter-sleep 3.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .critter-idle, .critter-happy, .critter-excited, .critter-celebrate, .critter-worried, .critter-sleep { animation: none; }
        }
      `}</style>
      <svg
        viewBox={viewBox}
        role="img"
        aria-label={model.name}
        className={MOOD_CLASS[effectiveMood]}
        style={{ width: "100%", height: "100%", transformOrigin: "center bottom" }}
        shapeRendering="crispEdges"
        preserveAspectRatio="xMidYMax meet"
      >
        {cells.map((c, i) => (
          // Cells overdraw by a hair so antialiased seams never show between blocks.
          <rect key={i} x={c.x - 0.02} y={c.y - 0.02} width={1.04} height={1.04} fill={c.c} />
        ))}
      </svg>
    </div>
  );
};

export default PixelSprite;
