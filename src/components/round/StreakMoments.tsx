import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import StreakMoment from "@/components/round/StreakMoment";
import RoundDevice from "@/components/round/RoundDevice";
import { celebrationFor, readSeen, writeSeen } from "@/components/round/streakSeen";
import { useStreaks, type Streak } from "@/hooks/useStreaks";
import { useRewards } from "@/hooks/useRewards";
import type { Child } from "@/hooks/useChildren";
import { overlayMotion, useMotionPrefs } from "@/lib/motion";
import { scrimClass } from "@/lib/focusStyles";
import { speak } from "@/lib/speech";
import { cn } from "@/lib/utils";

const seenOf = (s: Streak) => ({ rounds: s.rounds_completed, count: s.current_count });

/** How long a moment stays after it finishes playing. */
const LINGER_MS = { bead: 900, round: 3500 } as const;

/**
 * A streak's moments on the child's screen. A streak has no page or button
 * here: when a grown-up says yes (or the big star is won), the moment pops
 * over whatever is showing the next time the child is looking, plays once
 * and closes itself. The big star ends by pointing at the Rewards shop,
 * where the stars (and the streak's row) live.
 */
const StreakMoments = ({ child, picture, enabled = true, onOpenRewards }: {
  child: Child;
  picture: boolean;
  /** Off while the child is asleep, or when screens are shared side by side. */
  enabled?: boolean;
  onOpenRewards?: () => void;
}) => {
  const { streaks } = useStreaks([child.id]);
  const { rewards, purchases } = useRewards(child.id);
  // Stable between renders: the child screen re-renders every second.
  const active = useMemo(() => streaks.filter(s => s.is_active), [streaks]);
  const [playing, setPlaying] = useState<{ streak: Streak; kind: "bead" | "round"; key: string } | null>(null);
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  const closeTimer = useRef<number | null>(null);
  const { t } = useMotionPrefs();

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); }, []);

  // Anything new since this screen last showed it? One moment at a time.
  useEffect(() => {
    if (playing) return;
    for (const s of active) {
      const now = seenOf(s);
      const seen = readSeen(s.id);
      if (!seen) {
        // First time on this screen: nothing to cheer, just remember it.
        writeSeen(s.id, now);
        continue;
      }
      const kind = celebrationFor(now, seen);
      if (kind) {
        if (!visible || !enabled) return;
        setPlaying({ streak: s, kind, key: `${now.rounds}:${now.count}` });
        if (picture) speak(kind === "round" ? "Yay! You did it!" : "Yay! Another star!");
        return;
      }
      // Fewer stars than last time (a reset or an undo): catch up quietly.
      if (seen.rounds !== now.rounds || seen.count !== now.count) writeSeen(s.id, now);
    }
  }, [active, playing, visible, enabled, picture]);

  // Where the stars can go now: the best reward they can ask for, else the nearest.
  const shop = useMemo(() => {
    if (!rewards.length) return null;
    const pending = purchases.filter(p => p.status === "pending");
    const available = Math.max(0, child.currentCoins - pending.reduce((sum, p) => sum + p.coins_spent, 0));
    const open = rewards.filter(r => !pending.some(p => p.reward_id === r.id));
    const canGet = open.filter(r => r.cost <= available).sort((a, b) => b.cost - a.cost)[0];
    if (canGet) return { name: canGet.name, toGo: 0 };
    const next = [...open].sort((a, b) => a.cost - b.cost)[0];
    return next ? { name: next.name, toGo: next.cost - available } : null;
  }, [rewards, purchases, child.currentCoins]);

  const close = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    if (playing) writeSeen(playing.streak.id, seenOf(active.find(s => s.id === playing.streak.id) ?? playing.streak));
    setPlaying(null);
  };
  const onDone = () => {
    if (!playing) return;
    writeSeen(playing.streak.id, seenOf(active.find(s => s.id === playing.streak.id) ?? playing.streak));
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(close, LINGER_MS[playing.kind]);
  };

  const s = playing && (active.find(x => x.id === playing.streak.id) ?? playing.streak);
  return createPortal(
    <AnimatePresence>
      {playing && s && (
        <motion.div
          key="streak-moment"
          role="dialog"
          aria-modal="true"
          aria-label={playing.kind === "round" ? "You did it!" : "Another star!"}
          className={cn("fixed inset-0 z-50 flex items-center justify-center p-5", scrimClass)}
          {...overlayMotion}
          transition={t(overlayMotion.transition)}
          onClick={close}
        >
          <motion.div
            className="w-[min(88vw,64vh,420px)]"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={t({ type: "spring", stiffness: 320, damping: 26 })}
            onClick={e => e.stopPropagation()}
          >
            <RoundDevice>
              <StreakMoment
                kind={playing.kind}
                playKey={playing.key}
                name={s.name}
                icon={s.icon}
                moment={s.moment}
                target={s.target_days}
                count={playing.kind === "round" ? 0 : s.current_count}
                reward={s.reward_stars}
                mode={picture ? "little" : "big"}
                childName={child.name}
                shop={playing.kind === "round" ? shop : null}
                onShop={() => { close(); onOpenRewards?.(); }}
                onDone={onDone}
                outfit={child.pet_outfit}
                seed={child.id}
              />
            </RoundDevice>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default StreakMoments;
