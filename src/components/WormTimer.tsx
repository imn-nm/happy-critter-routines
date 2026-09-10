import { ReactNode } from "react";
import { Gamepad2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMotionPrefs } from "@/lib/motion";
import "./WormTimer.css";

interface WormTimerProps {
  /** Fraction of the optional task time consumed, from zero to one. */
  progress: number;
  icon?: ReactNode;
  className?: string;
}

export default function WormTimer({ progress, icon, className }: WormTimerProps) {
  const { reduce, t } = useMotionPrefs();
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const bite = Math.max(0, (p - .85) / .15);
  const full = p >= 1;
  const head = `calc(24px + (100% - 76px) * ${p})`;
  return (
    <div className={cn("noodle-worm", className)} data-full={full} data-hungry={bite > 0 && !full} data-reduced={reduce}
      role="progressbar" aria-label="Optional task time used" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.round(p * 100)} aria-valuetext={`${Math.round(p * 100)}% of optional task time used`}>
      <div className="noodle-track" aria-hidden />
      <div className="noodle-body" style={{ width: head }} aria-hidden />
      <div className="noodle-head-position" style={{ left: head }} aria-hidden>
        <motion.div className="noodle-face" animate={{ scaleX: full ? [1.15, .96, 1] : 1, scaleY: full ? [.88, 1.06, 1] : 1 }} transition={t({ duration: .65 })}>
          <svg viewBox="0 0 76 72" width="76" height="72">
            <path d="M9 43C7 29 17 20 33 23C44 18 58 22 62 33C70 45 60 61 45 61H20C11 61 7 53 9 43Z" fill="#F47778" />
            <path d="M14 48Q31 60 49 52" fill="none" stroke="#FFAB98" strokeWidth="7" strokeLinecap="round" />
            <ellipse cx="28" cy="27" rx="10" ry="12" fill="#FFF9E9" />
            <ellipse cx="48" cy="24" rx="11" ry="13" fill="#FFF9E9" />
            <g className="noodle-eyes">
              <ellipse cx="32" cy="29" rx="4" ry="5" fill="#291538" />
              <ellipse cx="52" cy="26" rx="4.5" ry="5.5" fill="#291538" />
              <circle cx="33" cy="27" r="1.3" fill="white" /><circle cx="53" cy="24" r="1.5" fill="white" />
            </g>
            <ellipse cx="27" cy="43" rx="6" ry="3.5" fill="#E75970" />
            {full ? <><path d="M45 42Q52 49 60 41" fill="none" stroke="#632D49" strokeWidth="2.5" strokeLinecap="round" /><ellipse cx="54" cy="50" rx="8" ry="5" fill="#FFAB98" /></> :
              <g style={{ transformOrigin: "55px 44px", transform: `scaleY(${.35 + bite * .85})` }}>
                <ellipse cx="56" cy="44" rx="12" ry="12" fill="#632D49" />
                <path d="M48 51Q55 45 63 51" fill="#F697A0" />
                <rect x="52" y="33" width="5" height="5" rx="1.5" fill="#FFF9E9" />
              </g>}
            <path d="M19 13l-3-4M42 8l1-5" stroke="#FFAB98" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </motion.div>
      </div>
      <motion.div className="noodle-task" aria-hidden style={{ transformOrigin: "left center" }}
        animate={{ scale: 1 - bite, x: -bite * 17, rotate: -bite * 24, opacity: 1 - bite * bite }}
        transition={t({ duration: .45, ease: "easeOut" })}>
        {icon ?? <Gamepad2 size={25} strokeWidth={2.3} />}
      </motion.div>
    </div>
  );
}
