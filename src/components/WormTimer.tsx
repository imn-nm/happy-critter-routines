import { ReactNode, useEffect, useRef, useState } from "react";
import { Gamepad2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMotionPrefs } from "@/lib/motion";
import "./WormTimer.css";

interface WormTimerProps { progress: number; icon?: ReactNode; className?: string }

// Figma "Child / Focus — redesigned", wormTimer (339:135): a 5px focus-mint
// track running into a 32px mint task circle, and a 14px focus-lavender worm
// whose head eats along the track as the time is used.
const HEIGHT = 55;
const PAD = 12;          // worm tail inset from the left edge
const ICON = 32;         // task circle diameter
const ICON_RIGHT = 24;   // task circle inset from the right edge
const HEAD_W = 22.6, HEAD_H = 21.4;
const BODY_H = 14;
const TRACK_H = 5;

/** Figma wormHead, open mouth (facing right). */
function HeadOpen() {
  return (
    <svg width={HEAD_W} height={HEAD_H} viewBox="0 0 22.5938 21.3682" fill="none" aria-hidden>
      <path d="M22.0331 8.41785H12.3941V11.0079H20.3451C21.2773 11.0079 22.0331 10.2522 22.0331 9.31992V8.41785Z" fill="#D9D9D9" />
      <path d="M19.9658 17.4832H11.0153V14.8931H18.2778C19.2101 14.8931 19.9658 15.6488 19.9658 16.5811V17.4832Z" fill="#D9D9D9" />
      <path d="M11.3604 0C5.08626 2.90836e-05 0 4.7839 0 10.6846C0.000244955 16.585 5.08641 21.3681 11.3604 21.3682C15.1984 21.3682 18.5899 19.5767 20.6465 16.8359H16.2793C14.1336 16.8359 12.3936 15.0959 12.3936 12.9502C12.3938 10.8047 14.1337 9.06543 16.2793 9.06543H22.2793C22.3852 9.06544 22.49 9.07078 22.5938 9.0791C21.7703 3.93997 17.0543 0 11.3604 0Z" fill="#A89AF0" />
      <Eye />
    </svg>
  );
}

/** Same head with the mouth closed — alternates with HeadOpen while eating. */
function HeadClosed() {
  return (
    <svg width={HEAD_W} height={HEAD_H} viewBox="0 0 22.5938 21.3682" fill="none" aria-hidden>
      <ellipse cx="11.3" cy="10.68" rx="11.3" ry="10.68" fill="#A89AF0" />
      <path d="M13 12.9H21.4" stroke="#20294A" strokeWidth="1.4" strokeLinecap="round" />
      <Eye />
    </svg>
  );
}

function Eye() {
  return (
    <>
      <ellipse cx="15.8358" cy="5.82765" rx="2.75401" ry="2.5901" fill="#D9D9D9" />
      <ellipse cx="16.8685" cy="6.1514" rx="1.72126" ry="1.61881" fill="black" />
    </>
  );
}

/** The worm eats along the track toward the task; in the last stretch it
 * takes bites out of the task circle from the left. The task never moves. */
export default function WormTimer({ progress, icon, className }: WormTimerProps) {
  const { reduce } = useMotionPrefs();
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(311);
  const target = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const [shown, setShown] = useState(target);
  const last = useRef(target);
  const [chompFrame, setChompFrame] = useState(0);
  // The jaw only works while time is actually being eaten. A bar that sits
  // still (a loss taken earlier in the day) must not look like it's still
  // losing, so each rise in progress keeps the mouth going a moment longer.
  const [advancing, setAdvancing] = useState(false);
  const lastTarget = useRef(target);
  useEffect(() => {
    const rose = target > lastTarget.current;
    lastTarget.current = target;
    setAdvancing(rose);
    if (!rose) return;
    const timer = window.setTimeout(() => setAdvancing(false), 1500);
    return () => window.clearTimeout(timer);
  }, [target]);
  const chewing = advancing && shown > 0 && shown < .9999;
  useEffect(() => {
    if (reduce || !chewing) { setChompFrame(0); return; }
    const timer = window.setInterval(() => setChompFrame(frame => (frame + 1) % 2), 160);
    return () => window.clearInterval(timer);
  }, [reduce, chewing]);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(140, entry.contentRect.width)));
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (reduce) { last.current = target; setShown(target); return; }
    const from = last.current, start = performance.now(); let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 420);
      last.current = from + (target - from) * (1 - (1 - t) ** 3);
      setShown(last.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [target, reduce]);

  const iconLeft = width - ICON_RIGHT - ICON;
  const iconRight = width - ICON_RIGHT;
  // Mouth = the head's right edge. Travels to the circle by 85%, then
  // across it for the last bites.
  const startMouth = PAD + HEAD_W;
  const bite = Math.max(0, (shown - .85) / .15);
  const mouth = shown < .85
    ? startMouth + (iconLeft - startMouth) * (shown / .85)
    : iconLeft + (iconRight - iconLeft) * bite;
  const headLeft = mouth - HEAD_W;
  const bodyRight = headLeft + HEAD_W / 2;
  const full = shown >= .9999;
  const open = !full && chewing && chompFrame === 0;
  const eaten = Math.max(0, Math.min(ICON, mouth - iconLeft));

  return (
    <div ref={root} className={cn("worm-timer", className)} style={{ height: HEIGHT }} role="progressbar"
      aria-label="Optional task time used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(target * 100)}>
      {/* Track: what's still left to eat. */}
      <div aria-hidden className="absolute rounded-pill bg-focus-mint"
        style={{ left: PAD + 10, width: Math.max(0, iconLeft + ICON / 2 - PAD - 10), height: TRACK_H, top: (HEIGHT - TRACK_H) / 2 }} />
      {/* Task circle — clipped from the left as the worm bites into it. */}
      <div aria-hidden className="absolute rounded-full bg-focus-mint flex items-center justify-center p-[3px] text-focus-bg"
        style={{ left: iconLeft, width: ICON, height: ICON, top: (HEIGHT - ICON) / 2, clipPath: eaten > 0 ? `inset(0 0 0 ${eaten}px)` : undefined }}>
        {icon ?? <Gamepad2 className="w-6 h-6" strokeWidth={1.7} />}
      </div>
      {/* Worm body */}
      <div aria-hidden className="absolute rounded-[10px] bg-focus-lavender"
        style={{ left: PAD, width: Math.max(BODY_H, bodyRight - PAD), height: BODY_H, top: (HEIGHT - BODY_H) / 2 + 1 }} />
      {/* Head */}
      <div aria-hidden className="absolute" style={{ left: headLeft, top: (HEIGHT - HEAD_H) / 2 - 1, width: HEAD_W, height: HEAD_H }}>
        {open || (!chewing && !full) ? <HeadOpen /> : <HeadClosed />}
      </div>
    </div>
  );
}
