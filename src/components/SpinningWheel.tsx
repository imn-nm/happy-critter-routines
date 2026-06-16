import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMotionPrefs, springs } from "@/lib/motion";
import { WHEEL_COLORS, getWheelOptions } from "@/lib/spinningWheel";

interface SpinningWheelProps {
  childId: string;
  sizePx?: number;
  className?: string;
}

// Split a label into up to 3 lines of ~9 chars so it stays inside its slice
// with breathing room on the sides instead of overflowing the rim.
function wrapLabel(text: string, maxChars = 9, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + " " + word).length <= maxChars) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  // Hard-truncate the final line if the label is very long.
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, maxChars - 1) + "…";
  }
  return lines.map((l) => (l.length > maxChars + 2 ? l.slice(0, maxChars + 1) + "…" : l));
}

const SpinningWheel = ({ childId, sizePx = 260, className }: SpinningWheelProps) => {
  const { t: tMotion } = useMotionPrefs();
  const options = getWheelOptions(childId);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
    };
  }, []);

  const sliceAngle = options.length > 0 ? 360 / options.length : 0;

  const spin = () => {
    if (spinning || options.length < 2) return;
    setSpinning(true);
    setWinner(null);

    // Land on a random slice, then compute which slice ends up under the
    // top pointer so the announcement always matches the arrow.
    const extraSpins = 5 + Math.floor(Math.random() * 5);
    const landWithinSlice = Math.random() * sliceAngle;
    const targetSliceIdx = Math.floor(Math.random() * options.length);

    // The pointer sits at the top (0°). A slice i originally spans
    // [i*sliceAngle, (i+1)*sliceAngle] measured clockwise from the top.
    // After rotating the wheel clockwise by R, the slice under the pointer is
    // the one whose original angle equals (360 - R) mod 360. So to land slice
    // `targetSliceIdx` under the pointer we rotate so that
    // (360 - finalMod) falls inside that slice.
    const desiredOriginalAngle = targetSliceIdx * sliceAngle + landWithinSlice;
    const finalMod = (360 - desiredOriginalAngle + 360) % 360;
    const currentMod = ((rotation % 360) + 360) % 360;
    const delta = ((finalMod - currentMod + 360) % 360) + extraSpins * 360;
    const nextRotation = rotation + delta;
    setRotation(nextRotation);

    spinTimeoutRef.current = setTimeout(() => {
      setWinner(options[targetSliceIdx]);
      setSpinning(false);
    }, 4000);
  };

  if (options.length < 2) {
    return (
      <div className={cn("flex flex-col items-center gap-2 text-center px-4", className)}>
        <span className="text-5xl">🎡</span>
        <p className="text-15 text-fog-50 font-medium">Spinning wheel not set up yet</p>
        <p className="text-13 text-fog-400 leading-snug">
          Ask a grown-up to add some fun activities!
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Pointer + wheel */}
      <div className="relative" style={{ width: sizePx, height: sizePx }}>
        {/* Top pointer — apex points down into the wheel at 12 o'clock. */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[2px] z-10">
          <div
            className="w-0 h-0"
            style={{
              borderLeft: "11px solid transparent",
              borderRight: "11px solid transparent",
              borderTop: "18px solid #f0b542",
              filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))",
            }}
          />
        </div>

        <motion.div
          className="w-full h-full rounded-full overflow-hidden shadow-[0_0_0_4px_rgba(255,255,255,0.08)]"
          animate={{ rotate: rotation }}
          transition={{
            duration: spinning ? 4 : 0,
            ease: [0.2, 0.85, 0.25, 1],
          }}
        >
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {options.map((opt, i) => {
              const startAngle = i * sliceAngle;
              const endAngle = startAngle + sliceAngle;
              // -90 so slice 0 starts at the top (12 o'clock), matching pointer.
              const startRad = (Math.PI / 180) * (startAngle - 90);
              const endRad = (Math.PI / 180) * (endAngle - 90);

              const x1 = 100 + 100 * Math.cos(startRad);
              const y1 = 100 + 100 * Math.sin(startRad);
              const x2 = 100 + 100 * Math.cos(endRad);
              const y2 = 100 + 100 * Math.sin(endRad);

              const largeArc = sliceAngle > 180 ? 1 : 0;
              const path = `M100,100 L${x1},${y1} A100,100 0 ${largeArc},1 ${x2},${y2} Z`;

              const midAngle = startAngle + sliceAngle / 2;
              const midRad = (Math.PI / 180) * (midAngle - 90);
              // Pull the label toward the rim so wider chords give more room,
              // but keep padding from the very edge.
              const labelR = 60;
              const labelX = 100 + labelR * Math.cos(midRad);
              const labelY = 100 + labelR * Math.sin(midRad);

              const lines = wrapLabel(opt);
              const fontSize = lines.length >= 3 ? 7.5 : options.length > 6 ? 8 : 9;
              const lineHeight = fontSize * 1.15;
              const firstDy = -((lines.length - 1) / 2) * lineHeight;

              return (
                <g key={i}>
                  <path d={path} fill={WHEEL_COLORS[i % WHEEL_COLORS.length]} stroke="#1a0a2e" strokeWidth={1.25} />
                  <text
                    x={labelX}
                    y={labelY}
                    fill="white"
                    fontSize={fontSize}
                    fontWeight={700}
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{ paintOrder: "stroke" }}
                    stroke="rgba(0,0,0,0.35)"
                    strokeWidth={0.5}
                  >
                    {lines.map((line, li) => (
                      <tspan key={li} x={labelX} dy={li === 0 ? firstDy : lineHeight}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
            {/* Hub */}
            <circle cx={100} cy={100} r={15} fill="#1a0a2e" />
            <circle cx={100} cy={100} r={10} fill="#271447" />
          </svg>
        </motion.div>
      </div>

      {/* Winner announcement */}
      <div className="min-h-[28px] flex items-center">
        <AnimatePresence mode="wait">
          {winner && !spinning && (
            <motion.div
              key={winner}
              className="text-center"
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={tMotion(springs.bouncy)}
            >
              <span className="text-20 font-bold text-fog-50">🎉 {winner}!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Spin button */}
      <button
        type="button"
        onClick={spin}
        disabled={spinning}
        className={cn(
          "px-8 py-2.5 rounded-full text-15 font-semibold transition-all",
          spinning
            ? "bg-iris-500/40 text-fog-300 cursor-not-allowed"
            : "bg-iris-500 text-white hover:bg-iris-400 active:scale-95",
        )}
      >
        {spinning ? "Spinning…" : "Spin!"}
      </button>
    </div>
  );
};

export default SpinningWheel;
