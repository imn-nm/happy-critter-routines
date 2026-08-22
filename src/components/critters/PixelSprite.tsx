import { CSSProperties, useMemo } from "react";
import { cn } from "@/lib/utils";
import { PixelCell, PixelModel } from "./pixelModel";

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

const key = (x: number, y: number) => `${x},${y}`;

/** One pixel cell rendered as a hair-overdrawn rect so seams never show. */
const Cell = ({ c }: { c: PixelCell }) => (
  <rect x={c.x - 0.02} y={c.y - 0.02} width={1.04} height={1.04} fill={c.c} />
);

/** Renders a flat pixel-art critter as a crisp SVG sprite with mood animation. */
const PixelSprite = ({ model, size = 160, animated = false, mood, className }: PixelSpriteProps) => {
  const effectiveMood: CritterMood = mood ?? (animated ? "idle" : "none");

  const { bodyCells, eyeCells, partRenders, eyeHolder, viewBox } = useMemo(() => {
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

    // Map each cell to the part that owns it (eye cells are never owned by a part).
    const parts = model.parts ?? [];
    const partOf = new Map<string, number>();
    parts.forEach((p, i) =>
      p.cells.forEach((c) => {
        const k = key(c.x, c.y);
        if (!partOf.has(k)) partOf.set(k, i);
      })
    );

    const bodyCells: PixelCell[] = [];
    const eyeCells: PixelCell[] = [];
    const partCells: PixelCell[][] = parts.map(() => []);
    for (const c of model.cells) {
      if (inEye(c)) { eyeCells.push(c); continue; }
      const pi = partOf.get(key(c.x, c.y));
      if (pi !== undefined) partCells[pi].push(c);
      else bodyCells.push(c);
    }

    const eyeHolder = parts.findIndex((p) => p.holdsEyes);

    // Precompute per-part render data: its cells, and the transform-origin
    // (pivot expressed relative to the part's own fill-box top-left).
    const partRenders = parts.map((p, i) => {
      const cells = partCells[i];
      let pMinX = Infinity, pMinY = Infinity;
      for (const c of cells) {
        pMinX = Math.min(pMinX, c.x);
        pMinY = Math.min(pMinY, c.y);
      }
      if (!Number.isFinite(pMinX)) { pMinX = p.pivot.x; pMinY = p.pivot.y; }
      const motion = p.motion?.[effectiveMood];
      return {
        name: p.name,
        cells,
        holdsEyes: !!p.holdsEyes,
        motion: motion && motion.type !== "none" ? motion : null,
        originX: p.pivot.x - pMinX,
        originY: p.pivot.y - pMinY,
      };
    });

    return {
      bodyCells,
      eyeCells,
      partRenders,
      eyeHolder,
      viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
    };
  }, [model, effectiveMood]);

  // Stagger blinks so a group of critters doesn't blink in unison.
  const blinkDelay = useMemo(() => {
    let h = 0;
    for (const ch of model.id) h = (h * 31 + ch.charCodeAt(0)) % 1000;
    return -(h / 1000) * 5.2; // seconds, spread across the blink cycle
  }, [model.id]);

  const eyeGroup = eyeCells.length > 0 && (
    <g className="critter-eyes" style={{ animationDelay: `${blinkDelay}s` }}>
      {eyeCells.map((c, i) => <Cell key={i} c={c} />)}
    </g>
  );

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
        /* Rigged parts — rotate about their pivot (transform-origin set inline) or translate. */
        @keyframes part-swing { 0%,100% { transform: rotate(calc(var(--amp,0) * -1deg)); } 50% { transform: rotate(calc(var(--amp,0) * 1deg)); } }
        @keyframes part-bob { 0%,100% { transform: translateY(calc(var(--amp,0) * -1px)); } 50% { transform: translateY(calc(var(--amp,0) * 1px)); } }
        @keyframes part-sway { 0%,100% { transform: translateX(calc(var(--amp,0) * -1px)); } 50% { transform: translateX(calc(var(--amp,0) * 1px)); } }
        .critter-part { transform-box: fill-box; }
        .part-swing { animation: part-swing 1s ease-in-out infinite; }
        .part-bob { animation: part-bob 1s ease-in-out infinite; }
        .part-sway { animation: part-sway 1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .critter-excited, .critter-celebrate, .critter-worried, .critter-eyes,
          .part-swing, .part-bob, .part-sway { animation: none; }
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
        {bodyCells.map((c, i) => <Cell key={i} c={c} />)}

        {partRenders.map((p, i) => {
          const style: CSSProperties = {};
          let cls = "";
          if (p.motion) {
            cls = `critter-part part-${p.motion.type}`;
            style.transformOrigin = `${p.originX}px ${p.originY}px`;
            (style as Record<string, string>)["--amp"] = String(p.motion.amp);
            style.animationDuration = `${p.motion.dur}s`;
            style.animationDelay = `${p.motion.delay ?? 0}s`;
          }
          return (
            <g key={i} className={cls || undefined} style={p.motion ? style : undefined}>
              {p.cells.map((c, j) => <Cell key={j} c={c} />)}
              {p.holdsEyes && eyeGroup}
            </g>
          );
        })}

        {eyeHolder < 0 && eyeGroup}
      </svg>
    </div>
  );
};

export default PixelSprite;
