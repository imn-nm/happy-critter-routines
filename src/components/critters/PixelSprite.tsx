import { CSSProperties, useMemo } from "react";
import { cn } from "@/lib/utils";
import { PixelCell, PixelModel } from "./pixelModel";

export type CritterMood = "none" | "idle" | "happy" | "excited" | "celebrate" | "worried" | "sleep" | "eating";

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
  eating: "",
};

// Lo-fi (Tamagotchi-style) reactions for `lofi` models. Every animation snaps
// between poses (step-end) for a low-framerate feel; ears skew from their rooted
// bottom edge so they stay attached, and the body squashes/hops in place.
// Scoped by a `react-<mood>` class on the wrapper.
const LOFI_CSS = `
  .pix-body { transform-origin: center bottom; }
  @keyframes lb-idle    { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1.5%); } }
  @keyframes lb-eat     { 0% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(1.5%) scaleY(0.95); } 100% { transform: translateY(0) scaleY(1); } }
  @keyframes lb-sleep   { 0%,100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(-1%) scaleY(1.04); } }
  @keyframes lb-sad     { 0% { transform: translateY(4%) scaleY(0.94) translateX(0); } 25% { transform: translateY(4%) scaleY(0.94) translateX(-2%); } 50% { transform: translateY(4%) scaleY(0.94) translateX(0); } 75% { transform: translateY(4%) scaleY(0.94) translateX(2%); } 100% { transform: translateY(4%) scaleY(0.94) translateX(0); } }
  @keyframes lb-cele    { 0% { transform: translateY(0) rotate(0); } 20% { transform: translateY(-22%) rotate(-5deg); } 40% { transform: translateY(0) rotate(0); } 60% { transform: translateY(-18%) rotate(5deg); } 80% { transform: translateY(0) rotate(0); } 100% { transform: translateY(0) rotate(0); } }
  /* Happy currently rests the same as idle (calm breathe), no shuffle. */
  .react-idle      .pix-body,
  .react-happy     .pix-body { animation: lb-idle 2.4s step-end infinite; }
  .react-eating    .pix-body { animation: lb-eat     0.3s step-end infinite; }
  .react-sleep     .pix-body { animation: lb-sleep   2.8s step-end infinite; }
  .react-worried   .pix-body { animation: lb-sad     0.5s step-end infinite; }
  .react-celebrate .pix-body { animation: lb-cele    0.9s step-end infinite; }

  .ear { transform-box: fill-box; transform-origin: 50% 100%; }
  @keyframes le-jiggle { 0%,100% { transform: skewX(0); } 50% { transform: skewX(calc(5deg * var(--s))); } }
  @keyframes le-droop  { 0% { transform: scaleY(0.58) skewX(calc(8deg * var(--s))); } 86% { transform: scaleY(0.58) skewX(calc(8deg * var(--s))); } 93% { transform: scaleY(0.62) skewX(calc(5deg * var(--s))); } 100% { transform: scaleY(0.58) skewX(calc(8deg * var(--s))); } }
  @keyframes le-cheer  { 0% { transform: skewX(0); } 20% { transform: skewX(calc(18deg * var(--s))); } 46% { transform: skewX(calc(-12deg * var(--s))); } 72% { transform: skewX(calc(14deg * var(--s))); } 100% { transform: skewX(0); } }
  @keyframes le-twitchL { 0%,85%,100% { transform: skewX(0); } 88% { transform: skewX(-12deg); } 92% { transform: skewX(-3deg); } 96% { transform: skewX(-9deg); } }
  .react-eating    .ear { animation: le-jiggle 0.6s step-end infinite; }
  .react-worried   .ear { animation: le-droop  1.6s step-end infinite; }
  .react-celebrate .ear { animation: le-cheer  0.9s step-end infinite; }
  .react-sleep     .ear { transform: skewX(calc(7deg * var(--s))) scaleY(0.92); }
  .react-idle      .earL,
  .react-happy     .earL { animation: le-twitchL 5s step-end infinite; }
  .react-sleep     .critter-eyes { transform: scaleY(0.1); animation: none; }

  .pix-carrot { position: absolute; left: 50%; bottom: 25%; width: 12%; height: 22%; transform: translateX(-50%); transform-origin: 50% 100%; z-index: 3; }
  .pix-carrot .cbody { position: absolute; left: 0; bottom: 0; width: 100%; height: 76%; background: #f4935e; clip-path: polygon(16% 0, 84% 0, 54% 100%, 46% 100%); }
  .pix-carrot .cleaf { position: absolute; left: 50%; top: 0; transform: translateX(-50%); width: 82%; height: 34%; background: #5fa03e; clip-path: polygon(50% 100%, 0 45%, 16% 0, 34% 45%, 50% 0, 66% 45%, 84% 0, 100% 45%); }
  @keyframes lnibble { 0% { transform: translateX(-50%) scale(1); opacity: 1; } 24% { transform: translateX(-50%) scale(1); opacity: 1; } 25% { transform: translateX(-50%) scale(0.78); } 49% { transform: translateX(-50%) scale(0.78); } 50% { transform: translateX(-50%) scale(0.55); } 74% { transform: translateX(-50%) scale(0.55); } 75% { transform: translateX(-50%) scale(0.3); } 92% { transform: translateX(-50%) scale(0.3); opacity: 1; } 93% { transform: translateX(-50%) scale(0.3); opacity: 0; } 100% { transform: translateX(-50%) scale(1); opacity: 1; } }
  .react-eating .pix-carrot { animation: lnibble 2.4s step-end infinite; }

  .pix-zzz { position: absolute; right: 8%; top: 10%; font-family: system-ui, sans-serif; font-weight: 800; color: currentColor; opacity: 0.75; }
  .pix-zzz span { display: inline-block; }
  @keyframes lzfloat { 0% { transform: translateY(30%) scale(0.7); opacity: 0; } 30% { opacity: 0.8; } 100% { transform: translateY(-60%) scale(1.1); opacity: 0; } }
  .react-sleep .pix-zzz span:nth-child(1) { animation: lzfloat 2.4s step-end infinite; font-size: 0.5em; }
  .react-sleep .pix-zzz span:nth-child(2) { animation: lzfloat 2.4s step-end infinite; animation-delay: 0.8s; font-size: 0.7em; }
  .react-sleep .pix-zzz span:nth-child(3) { animation: lzfloat 2.4s step-end infinite; animation-delay: 1.6s; font-size: 0.9em; }

  .pix-confetti { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .pix-confetti i { position: absolute; top: -12%; width: 0.26em; height: 0.42em; border-radius: 1px; opacity: 0; }
  @keyframes lconfetti { 0% { top: -12%; opacity: 1; transform: translateX(0) rotate(0deg); } 100% { top: 112%; opacity: 1; transform: translateX(var(--dx, 0)) rotate(560deg); } }
  .react-celebrate .pix-confetti i { animation: lconfetti 1.1s linear infinite; }

  @media (prefers-reduced-motion: reduce) {
    .pix-body, .ear, .pix-carrot, .pix-zzz span, .pix-confetti i { animation: none !important; }
  }
`;

// Confetti pieces for the celebrate reaction: staggered falls with sideways drift.
const CONFETTI = [
  { left: "12%", background: "#ee6fa4", "--dx": "1.2em", animationDelay: "0s" },
  { left: "24%", background: "#f4935e", "--dx": "-0.8em", animationDelay: "0.5s" },
  { left: "36%", background: "#f6d743", "--dx": "0.6em", animationDelay: "0.2s" },
  { left: "48%", background: "#8fbf6f", "--dx": "-1em", animationDelay: "0.8s" },
  { left: "58%", background: "#7ec8e3", "--dx": "1em", animationDelay: "0.35s" },
  { left: "68%", background: "#ee6fa4", "--dx": "-0.6em", animationDelay: "0.15s" },
  { left: "78%", background: "#f4935e", "--dx": "0.9em", animationDelay: "0.6s" },
  { left: "88%", background: "#f6d743", "--dx": "-1.1em", animationDelay: "0.9s" },
  { left: "18%", background: "#8fbf6f", "--dx": "0.7em", animationDelay: "1s" },
] as const;

const key = (x: number, y: number) => `${x},${y}`;

// Seconds each pose frame is held on screen; total cycle = frames × this.
const POSE_FRAME_SECS = 0.4;

/**
 * Stepped show/hide keyframes for a sequence of `total` frames: frame i is
 * visible during its 1/total slice of the cycle, everything else hidden —
 * a lo-fi flipbook driven purely by CSS.
 */
const poseSeqCss = (total: number): string => {
  const dur = (total * POSE_FRAME_SECS).toFixed(2);
  let css = "";
  for (let i = 0; i < total; i++) {
    const from = ((i / total) * 100).toFixed(2);
    const to = (((i + 1) / total) * 100).toFixed(2);
    const kf =
      i === 0
        ? `0% { opacity: 1; } ${to}% { opacity: 0; } 100% { opacity: 0; }`
        : i === total - 1
        ? `0% { opacity: 0; } ${from}% { opacity: 1; } 100% { opacity: 1; }`
        : `0% { opacity: 0; } ${from}% { opacity: 1; } ${to}% { opacity: 0; } 100% { opacity: 0; }`;
    css += `@keyframes pose-f${i} { ${kf} }\n.pose-flip .pose-f${i} { animation: pose-f${i} ${dur}s step-end infinite; }\n`;
  }
  return css;
};

/** One pixel cell rendered as a hair-overdrawn rect so seams never show. */
const Cell = ({ c }: { c: PixelCell }) => (
  <rect x={c.x - 0.02} y={c.y - 0.02} width={1.04} height={1.04} fill={c.c} />
);

/** Renders a flat pixel-art critter as a crisp SVG sprite with mood animation. */
const PixelSprite = ({ model, size = 160, animated = false, mood, className }: PixelSpriteProps) => {
  const effectiveMood: CritterMood = mood ?? (animated ? "idle" : "none");

  const { bodyCells, backingCells, eyeCells, partRenders, eyeHolder, viewBox } = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    // Bounds cover the base drawing and every pose so the sprite doesn't
    // reframe when a pose frame extends past the base silhouette.
    const allCells = [...model.cells, ...(model.poses ?? []).flatMap((p) => p.cells)];
    for (const c of allCells) {
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

    const colorAt = new Map<string, string>();
    for (const c of model.cells) colorAt.set(key(c.x, c.y), c.c);

    const bodyCells: PixelCell[] = [];
    const eyeCells: PixelCell[] = [];
    const partCells: PixelCell[][] = parts.map(() => []);
    for (const c of model.cells) {
      if (inEye(c)) { eyeCells.push(c); continue; }
      const pi = partOf.get(key(c.x, c.y));
      if (pi !== undefined) partCells[pi].push(c);
      else bodyCells.push(c);
    }

    // Blinking eyes collapse to reveal what's behind them — but the eye cells
    // were lifted out of the body, leaving a hole. Paint a face-colored backing
    // behind each eye (sampled from an adjacent non-eye cell) so a blink shows
    // the face, not the page background.
    const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    const backingCells: PixelCell[] = eyeCells.map((c) => {
      let col: string | undefined;
      for (const [dx, dy] of NB) {
        const nk = key(c.x + dx, c.y + dy);
        if (colorAt.has(nk) && !inEye({ x: c.x + dx, y: c.y + dy })) { col = colorAt.get(nk); break; }
      }
      return { x: c.x, y: c.y, c: col ?? "#f6f1da" };
    });

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
      backingCells,
      eyeCells,
      partRenders,
      eyeHolder,
      viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
    };
  }, [model, effectiveMood]);

  // Poses named after the current mood replace transform motion with a
  // hand-drawn stepped frame sequence: base → pose 1 → pose 2 → …, cycling.
  // Several poses sharing one name are that mood's frames, in array order.
  const poseSeq = useMemo(() => {
    const frames = (model.poses ?? [])
      .filter((p) => p.name === effectiveMood && p.cells.length > 0)
      .map((p) => p.cells);
    return frames.length ? [model.cells, ...frames] : null;
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

  const isLofi = !!model.lofi;

  return (
    <div
      className={cn(
        "inline-block",
        isLofi && effectiveMood !== "none" && `react-${effectiveMood}`,
        poseSeq && "pose-flip",
        className
      )}
      style={{ width: size, height: size, position: isLofi ? "relative" : undefined, fontSize: isLofi ? `${size * 0.16}px` : undefined }}
    >
      <style>{`
        /* Resting moods stay put and come alive through blinking instead of bobbing. */
        /* Excited = a natural jump: crouch (anticipation), stretch on launch, hang
           at the apex, squash on landing, then a small rebound. Feet stay planted
           via transform-origin: center bottom. */
        @keyframes critter-excited {
          0%   { transform: translateY(0) scale(1, 1); }
          10%  { transform: translateY(3%) scale(1.08, 0.9); }
          30%  { transform: translateY(-20%) scale(0.95, 1.1); }
          48%  { transform: translateY(-26%) scale(1, 1); }
          66%  { transform: translateY(-6%) scale(0.98, 1.04); }
          82%  { transform: translateY(0) scale(1.12, 0.86); }
          92%  { transform: translateY(0) scale(0.98, 1.03); }
          100% { transform: translateY(0) scale(1, 1); }
        }
        @keyframes critter-celebrate { 0% { transform: translateY(0) scale(1); } 30% { transform: translateY(-14%) scale(1.06); } 55% { transform: translateY(0) scale(1); } 70% { transform: translateY(-6%) scale(1.03); } 100% { transform: translateY(0) scale(1); } }
        @keyframes critter-worried { 0%,100% { transform: rotate(0deg); } 20% { transform: rotate(-4deg); } 40% { transform: rotate(4deg); } 60% { transform: rotate(-3deg); } 80% { transform: rotate(2deg); } }
        .critter-excited { animation: critter-excited 0.9s ease-in-out infinite; }
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
        /* Flop = a damped wiggle for floppy bits (ears): whip out, then settle. */
        @keyframes part-flop {
          0%   { transform: rotate(0deg); }
          15%  { transform: rotate(calc(var(--amp,0) * 1deg)); }
          35%  { transform: rotate(calc(var(--amp,0) * -0.55deg)); }
          55%  { transform: rotate(calc(var(--amp,0) * 0.3deg)); }
          75%  { transform: rotate(calc(var(--amp,0) * -0.15deg)); }
          90%  { transform: rotate(calc(var(--amp,0) * 0.06deg)); }
          100% { transform: rotate(0deg); }
        }
        .critter-part { transform-box: fill-box; }
        .part-swing { animation: part-swing 1s ease-in-out infinite; }
        .part-bob { animation: part-bob 1s ease-in-out infinite; }
        .part-sway { animation: part-sway 1s ease-in-out infinite; }
        .part-flop { animation: part-flop 1s ease-in-out infinite; }
        /* Hand-drawn pose sequence: base → pose frames, stepped lo-fi flipbook.
           Only the first frame shows until its animation kicks in. */
        .pose-f { opacity: 0; }
        .pose-frame-first { opacity: 1; }
        /* A pose sequence replaces transform motion for its mood. */
        .pose-flip .pix-body, .pose-flip svg { animation: none !important; }
        ${poseSeq ? poseSeqCss(poseSeq.length) : ""}
        @media (prefers-reduced-motion: reduce) {
          .critter-excited, .critter-celebrate, .critter-worried, .critter-eyes,
          .part-swing, .part-bob, .part-sway, .part-flop,
          .pose-f { animation: none !important; }
        }
        ${isLofi ? LOFI_CSS : ""}
      `}</style>
      <svg
        viewBox={viewBox}
        role="img"
        aria-label={model.name}
        className={isLofi ? "pix-body" : MOOD_CLASS[effectiveMood]}
        // overflow visible so a jump/stretch isn't clipped at the sprite's edge.
        style={{ width: "100%", height: "100%", transformOrigin: "center bottom", overflow: "visible" }}
        shapeRendering="crispEdges"
        preserveAspectRatio="xMidYMax meet"
      >
        {poseSeq ? (
          <>
            {/* Flipbook: each frame is a full drawing shown for its slice of the cycle. */}
            {poseSeq.map((cells, i) => (
              <g key={i} className={`pose-f pose-f${i}${i === 0 ? " pose-frame-first" : ""}`}>
                {cells.map((c, j) => <Cell key={j} c={c} />)}
              </g>
            ))}
          </>
        ) : (
          <>
        {bodyCells.map((c, i) => <Cell key={i} c={c} />)}
        {/* Face-colored backing so a blink reveals the face, not the background. */}
        {backingCells.map((c, i) => <Cell key={`bk${i}`} c={c} />)}

        {partRenders.map((p, i) => {
          // Lo-fi: ears skew from their rooted base, driven by mood-scoped CSS.
          if (isLofi) {
            return (
              <g key={i} className={`ear ${p.name}`} style={{ ["--s" as string]: p.name === "earR" ? 1 : -1 } as CSSProperties}>
                {p.cells.map((c, j) => <Cell key={j} c={c} />)}
                {p.holdsEyes && eyeGroup}
              </g>
            );
          }
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
          </>
        )}
      </svg>

      {/* Lo-fi mood props layered over the sprite. */}
      {isLofi && effectiveMood === "eating" && (
        <div className="pix-carrot" aria-hidden="true"><span className="cleaf" /><span className="cbody" /></div>
      )}
      {isLofi && effectiveMood === "sleep" && (
        <div className="pix-zzz" aria-hidden="true"><span>z</span><span>z</span><span>z</span></div>
      )}
      {isLofi && effectiveMood === "celebrate" && (
        <div className="pix-confetti" aria-hidden="true">
          {CONFETTI.map((p, i) => <i key={i} style={p as CSSProperties} />)}
        </div>
      )}
    </div>
  );
};

export default PixelSprite;
