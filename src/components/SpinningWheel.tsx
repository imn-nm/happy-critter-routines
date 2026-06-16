import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMotionPrefs, springs } from "@/lib/motion";
import { Pencil, Plus, X, Shuffle } from "lucide-react";

interface SpinningWheelProps {
  childId: string;
  sizePx?: number;
  className?: string;
}

const COLORS = [
  "#879bff", // iris
  "#38b2a4", // mint
  "#ff6666", // coral
  "#f0b542", // gold
  "#c084fc", // purple
  "#fb923c", // orange
  "#4ade80", // green
  "#60a5fa", // blue
];

const STORAGE_KEY = (childId: string) => `spinning-wheel:${childId}`;

function getStoredOptions(childId: string): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(childId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function storeOptions(childId: string, options: string[]) {
  localStorage.setItem(STORAGE_KEY(childId), JSON.stringify(options));
}

const SpinningWheel = ({ childId, sizePx = 260, className }: SpinningWheelProps) => {
  const { t: tMotion } = useMotionPrefs();
  const [options, setOptions] = useState<string[]>(() => getStoredOptions(childId));
  const [editing, setEditing] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [newOption, setNewOption] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
    };
  }, []);

  const saveOptions = useCallback(
    (opts: string[]) => {
      setOptions(opts);
      storeOptions(childId, opts);
    },
    [childId],
  );

  const addOption = () => {
    const trimmed = newOption.trim();
    if (!trimmed || options.length >= 8) return;
    saveOptions([...options, trimmed]);
    setNewOption("");
    inputRef.current?.focus();
  };

  const removeOption = (idx: number) => {
    saveOptions(options.filter((_, i) => i !== idx));
  };

  const spin = () => {
    if (spinning || options.length < 2) return;
    setSpinning(true);
    setWinner(null);

    const extraSpins = 5 + Math.random() * 5;
    const targetDeg = extraSpins * 360 + Math.random() * 360;
    setRotation((prev) => prev + targetDeg);

    spinTimeoutRef.current = setTimeout(() => {
      const sliceAngle = 360 / options.length;
      const normalizedAngle = ((rotation + targetDeg) % 360);
      const pointerAngle = (360 - normalizedAngle + sliceAngle / 2) % 360;
      const winnerIdx = Math.floor(pointerAngle / sliceAngle) % options.length;
      setWinner(options[winnerIdx]);
      setSpinning(false);
    }, 4000);
  };

  const hasWheel = options.length >= 2;
  const showSetup = !hasWheel || editing;

  // --- Setup / Edit View ---
  if (showSetup) {
    return (
      <div className={cn("flex flex-col items-center gap-3 w-full", className)}>
        <div className="flex items-center gap-2">
          <Shuffle className="w-5 h-5 text-iris-400" />
          <span className="text-16 font-medium text-fog-50">
            {hasWheel ? "Edit Wheel" : "Set Up Spinning Wheel"}
          </span>
        </div>
        <p className="text-13 text-fog-400 text-center leading-snug">
          Add things you like to do during free time!
        </p>

        <div className="w-full flex flex-col gap-2 max-w-[280px]">
          {options.map((opt, i) => (
            <motion.div
              key={`${i}-${opt}`}
              className="flex items-center gap-2 bg-[#271447] rounded-2xl px-3 py-2"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={tMotion(springs.gentle)}
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="text-14 text-fog-50 truncate flex-1">{opt}</span>
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="p-1 text-fog-400 hover:text-coral-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}

          {options.length < 8 && (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addOption()}
                placeholder="e.g. Draw, Read, Play outside"
                maxLength={30}
                className="flex-1 min-w-0 bg-[#271447] text-fog-50 placeholder:text-fog-600 text-14 px-3 py-2 rounded-2xl border border-transparent focus:border-iris-500 focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={addOption}
                disabled={!newOption.trim()}
                className="p-2 rounded-full bg-iris-500 text-white disabled:opacity-40 transition-opacity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-1">
          {hasWheel && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-13 text-fog-50 bg-[#271447] rounded-full hover:bg-[#2f1856] transition-colors"
            >
              Done
            </button>
          )}
          {options.length < 2 && (
            <p className="text-12 text-fog-500 italic">Add at least 2 options</p>
          )}
        </div>
      </div>
    );
  }

  // --- Wheel View ---
  const sliceAngle = 360 / options.length;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Pointer */}
      <div className="relative" style={{ width: sizePx, height: sizePx }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
          <div
            className="w-0 h-0"
            style={{
              borderLeft: "10px solid transparent",
              borderRight: "10px solid transparent",
              borderTop: "16px solid #f0b542",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
            }}
          />
        </div>

        {/* Wheel */}
        <motion.div
          className="w-full h-full rounded-full overflow-hidden"
          style={{
            background: "conic-gradient(from 0deg, transparent, transparent)",
          }}
          animate={{ rotate: rotation }}
          transition={{
            duration: spinning ? 4 : 0,
            ease: [0.2, 0.8, 0.3, 1],
          }}
        >
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {options.map((opt, i) => {
              const startAngle = i * sliceAngle;
              const endAngle = startAngle + sliceAngle;
              const startRad = (Math.PI / 180) * (startAngle - 90);
              const endRad = (Math.PI / 180) * (endAngle - 90);

              const x1 = 100 + 100 * Math.cos(startRad);
              const y1 = 100 + 100 * Math.sin(startRad);
              const x2 = 100 + 100 * Math.cos(endRad);
              const y2 = 100 + 100 * Math.sin(endRad);

              const largeArc = sliceAngle > 180 ? 1 : 0;
              const path = `M100,100 L${x1},${y1} A100,100 0 ${largeArc},1 ${x2},${y2} Z`;

              const midAngle = (startAngle + endAngle) / 2;
              const midRad = (Math.PI / 180) * (midAngle - 90);
              const labelR = 62;
              const labelX = 100 + labelR * Math.cos(midRad);
              const labelY = 100 + labelR * Math.sin(midRad);

              return (
                <g key={i}>
                  <path d={path} fill={COLORS[i % COLORS.length]} stroke="#1a0a2e" strokeWidth={1} />
                  <text
                    x={labelX}
                    y={labelY}
                    fill="white"
                    fontSize={options.length <= 4 ? 10 : 8}
                    fontWeight={600}
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${midAngle}, ${labelX}, ${labelY})`}
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                  >
                    {opt.length > 12 ? opt.slice(0, 11) + "…" : opt}
                  </text>
                </g>
              );
            })}
            <circle cx={100} cy={100} r={14} fill="#1a0a2e" />
            <circle cx={100} cy={100} r={10} fill="#271447" />
          </svg>
        </motion.div>
      </div>

      {/* Winner announcement */}
      <AnimatePresence>
        {winner && !spinning && (
          <motion.div
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

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={spin}
          disabled={spinning}
          className={cn(
            "px-6 py-2.5 rounded-full text-15 font-semibold transition-all",
            spinning
              ? "bg-iris-500/40 text-fog-300 cursor-not-allowed"
              : "bg-iris-500 text-white hover:bg-iris-400 active:scale-95",
          )}
        >
          {spinning ? "Spinning…" : "Spin!"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setWinner(null);
          }}
          className="p-2.5 rounded-full bg-[#271447] text-fog-300 hover:text-fog-50 hover:bg-[#2f1856] transition-colors"
          title="Edit options"
        >
          <Pencil className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default SpinningWheel;
