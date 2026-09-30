import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import RoundStreakScreen, { type StreakCelebration } from "@/components/round/RoundStreakScreen";
import RoundDevice from "@/components/round/RoundDevice";
import StreakStar from "@/components/round/StreakStar";
import { celebrationFor, readSeen, writeSeen } from "@/components/round/streakSeen";
import { useStreaks, type Streak } from "@/hooks/useStreaks";
import type { Child } from "@/hooks/useChildren";
import { unlockSounds } from "@/lib/sounds";
import { overlayMotion, useMotionPrefs } from "@/lib/motion";
import { scrimClass } from "@/lib/focusStyles";
import { cn } from "@/lib/utils";

const seenOf = (s: Streak) => ({ rounds: s.rounds_completed, count: s.current_count });

/** After a celebration it opened by itself, the round screen closes on its own. */
const AUTO_CLOSE_MS = 3000;

/**
 * The child's streaks on the child screen: a star button beside their star
 * count that opens the round streak screen, one streak per page. When a
 * parent says yes (or a round finishes) it opens by itself the next time
 * the child is looking, plays the bead once and closes again, the same
 * moment the Piko device shows.
 */
const KidStreaks = ({ child, picture, autoOpen = true }: { child: Child; picture: boolean; autoOpen?: boolean }) => {
  const { streaks } = useStreaks([child.id]);
  // Stable between renders: the child screen re-renders every second.
  const active = useMemo(() => streaks.filter(s => s.is_active), [streaks]);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [celebrate, setCelebrate] = useState<(StreakCelebration & { streakId: string }) | null>(null);
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  const openedByCheer = useRef(false);
  const closeTimer = useRef<number | null>(null);
  const { t } = useMotionPrefs();

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); }, []);

  // Anything new since this screen last showed it? One cheer at a time.
  useEffect(() => {
    if (celebrate) return;
    for (let i = 0; i < active.length; i++) {
      const s = active[i];
      const now = seenOf(s);
      const seen = readSeen(s.id);
      if (!seen) {
        // First time on this screen: nothing to cheer, just remember it.
        writeSeen(s.id, now);
        continue;
      }
      const kind = celebrationFor(now, seen);
      if (kind) {
        // Wait until the child is looking. Without auto-open (children side
        // by side) it plays when they open their streaks themselves.
        if (!visible || (!autoOpen && !open)) return;
        setIndex(i);
        if (!open) openedByCheer.current = true;
        setOpen(true);
        setCelebrate({ kind, key: `${now.rounds}:${now.count}`, streakId: s.id });
        return;
      }
      // Fewer beads than last time (a reset or an undo): catch up quietly.
      if (seen.rounds !== now.rounds || seen.count !== now.count) writeSeen(s.id, now);
    }
  }, [active, celebrate, visible, autoOpen, open]);

  const close = useCallback(() => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    openedByCheer.current = false;
    setOpen(false);
  }, []);

  // RoundStreakScreen keeps the latest of this, so it sees the current state.
  const onCelebrated = () => {
    const s = celebrate && active.find(x => x.id === celebrate.streakId);
    if (s) writeSeen(s.id, seenOf(s));
    setCelebrate(null);
    if (openedByCheer.current) {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
      closeTimer.current = window.setTimeout(close, AUTO_CLOSE_MS);
    }
  };

  // The child took over (turned a page, tapped): don't close on them.
  const keepOpen = () => {
    openedByCheer.current = false;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  };

  if (active.length === 0) return null;
  const page = Math.min(index, active.length - 1);
  const s = active[page];
  const first = active[0];
  const go = (d: number) => {
    keepOpen();
    if (celebrate) return;
    setIndex(i => (i + d + active.length) % active.length);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { unlockSounds(); keepOpen(); setIndex(0); setOpen(true); }}
        aria-label={`Streaks: ${first.name}, ${first.current_count} of ${first.target_days}`}
        className={cn(
          "inline-flex shrink-0 items-center rounded-[14px] border border-focus-amber/60 bg-focus-amber/10 font-semibold text-focus-amber transition-colors hover:bg-focus-amber/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender",
          picture ? "h-12 gap-1 px-3" : "h-11 gap-1.5 px-3",
        )}
      >
        <StreakStar state="filled" className={picture ? "h-7 w-7" : "h-5 w-5"} />
        {!picture && (
          <span className="text-[14px] leading-4 tabular-nums">{first.current_count}/{first.target_days}</span>
        )}
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              key="kid-streaks"
              role="dialog"
              aria-modal="true"
              aria-label="Streaks"
              className={cn("fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 p-5", scrimClass)}
              {...overlayMotion}
              transition={t(overlayMotion.transition)}
              onClick={e => { if (e.target === e.currentTarget) close(); }}
            >
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="absolute right-4 top-4 flex h-14 w-14 items-center justify-center rounded-full bg-focus-surface text-focus-muted hover:text-focus-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
              >
                <X className="h-7 w-7" />
              </button>
              <motion.div
                className="w-[min(88vw,64vh,420px)]"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.94, opacity: 0 }}
                transition={t({ type: "spring", stiffness: 320, damping: 26 })}
                onPointerDown={keepOpen}
              >
                <RoundDevice>
                  <RoundStreakScreen
                    key={s.id}
                    name={s.name}
                    icon={s.icon}
                    moment={s.moment}
                    target={s.target_days}
                    count={s.current_count}
                    reward={s.reward_stars}
                    mode={picture ? "little" : "big"}
                    stars={child.currentCoins}
                    celebrate={celebrate?.streakId === s.id ? celebrate : null}
                    onCelebrated={onCelebrated}
                    outfit={child.pet_outfit}
                    seed={child.id}
                    page={{ index: page, total: active.length }}
                  />
                </RoundDevice>
              </motion.div>
              {active.length > 1 && (
                <div className="flex gap-4">
                  <button type="button" onClick={() => go(-1)} aria-label="Previous streak" className="flex h-14 w-14 items-center justify-center rounded-full bg-focus-surface text-focus-text hover:bg-focus-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender">
                    <ChevronLeft className="h-8 w-8" />
                  </button>
                  <button type="button" onClick={() => go(1)} aria-label="Next streak" className="flex h-14 w-14 items-center justify-center rounded-full bg-focus-surface text-focus-text hover:bg-focus-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender">
                    <ChevronRight className="h-8 w-8" />
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
};

export default KidStreaks;
