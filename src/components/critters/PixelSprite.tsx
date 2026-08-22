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
  const { bodyCells, eyeCells, viewBox } = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of model.cells) {
      minX = Math.min(minX, c.x);
      maxX = Math.max(maxX, c.x + 1);
      minY = Math.min(minY, c.y);
      maxY = Math.max(maxY, c.y + 1);
    }
    const eyes = model.eyes ?? [];
    const inEye = (c: { x: number; y: number }) =>
      eyes.some((e) => c.x >= e.x1 && c.x <= e.x2 && c.y >= e.y1 && c.y <= e.y2);
    return {
      bodyCells: model.cells.filter((c) => !inEye(c)),
      eyeCells: model.cells.filter(inEye),
      viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
    };
  }, [model]);

  const effectiveMood: CritterMood = mood ?? (animated ? "idle" : "none");
  // Stagger blinks so a group of critters doesn't blink in unison.
  const blinkDelay = useMemo(() => {
    let h = 0;
    for (const ch of model.id) h = (h * 31 + ch.charCodeAt(0)) % 1000;
    return -(h / 1000) * 5.2; // seconds, spread across the blink cycle
  }, [model.id]);

  return (
    <div className={cn("inline-block", className)} style={{ width: size, height: size }}>
      <style>{`
        /* Resting moods stay put and come alive through blinking instead of bobbing. */
        @keyframes critter-excited { 0%,100% { transform: translateY(0) rotate(-2deg); } 25% { transform: translateY(-9%) rotate(2deg); } 50% { transform: translateY(0) rotate(-2deg); } 75% { transform: translateY(-5%) rotate(2deg); } }
        @keyframes critter-celebrate { 0% { transform: translateY(0) scale(1); } 30% { transform: translateY(-14%) scale(1.06); } 55% { transform: translateY(0) scale(1); } 70% { transform: translateY(-6%) scale(1.03); } 100% { transform: translateY(0) scale(1); } }
        @keyframes critter-worried { 0%,100% { transform: rotate(0deg); } 20% { transform: rotate(-4deg); } 40% { transform: rotate(4deg); } 60% { transform: rotate(-3deg); } 80% { transform: rotate(2deg); } }
        .critter-excited { animation: critter-excited 0.7s ease-in-out infinite; }
        .critter-celebrate { animation: critter-celebrate 0.9s ease-in-out infinite; }
        .critter-worried { animation: critter-worried 0.6s ease-in-out infinite; }
        /* Natural blink: eyes stay open, then snap shut and reopen for a moment. */
        @keyframes critter-blink { 0%,92%,100% { transform: scaleY(1); } 96% { transform: scaleY(0.08); } }
        .critter-eyes { transform-box: fill-box; transform-origin: center; animation: critter-blink 5.2s ease-in-out infinite; }
        .critter-sleep .critter-eyes { transform: scaleY(0.12); animation: none; }
        @media (prefers-reduced-motion: reduce) {
          .critter-excited, .critter-celebrate, .critter-worried, .critter-eyes { animation: none; }
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
        {bodyCells.map((c, i) => (
          // Cells overdraw by a hair so antialiased seams never show between blocks.
          <rect key={i} x={c.x - 0.02} y={c.y - 0.02} width={1.04} height={1.04} fill={c.c} />
        ))}
        {eyeCells.length > 0 && (
          <g className="critter-eyes" style={{ animationDelay: `${blinkDelay}s` }}>
            {eyeCells.map((c, i) => (
              <rect key={i} x={c.x - 0.02} y={c.y - 0.02} width={1.04} height={1.04} fill={c.c} />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
};

export default PixelSprite;
