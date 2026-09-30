import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import StreakSheet from "@/components/streaks/StreakSheet";
import StreakStar from "@/components/round/StreakStar";
import { checkInLabel } from "@/data/streakPresets";
import { streakToday, useStreaks, type Streak, type StreakDay } from "@/hooks/useStreaks";
import type { Child } from "@/hooks/useChildren";
import { getTaskIconComponent } from "@/utils/taskIcon";
import { toPSTDateString } from "@/utils/pstDate";
import { springs, useMotionPrefs } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Streaks on the parent's phone: one card per streak with today's one-tap
 * check-in (Yes / Not this time), a "+ New" button, and the sheet to set one
 * up. Used on the parent home for every child, and from a child's page for
 * just that child (with paused streaks too).
 */
const StreaksSection = ({
  kids,
  includePaused = false,
  heading = "Streaks",
  className,
}: {
  kids: Child[];
  includePaused?: boolean;
  heading?: string | null;
  className?: string;
}) => {
  const childIds = useMemo(() => kids.map(k => k.id), [kids]);
  const { streaks, loading, answerOn, createStreaks, updateStreak, deleteStreak, markDay, marking } = useStreaks(childIds);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Streak | null>(null);
  const today = streakToday();

  // Still to answer today first, then the rest; paused last.
  const rank = (s: Streak) => (!s.is_active ? 2 : answerOn(s.id, today) ? 1 : 0);
  const shown = streaks.filter(s => includePaused || s.is_active).sort((a, b) => rank(a) - rank(b));

  const openNew = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (s: Streak) => { setEditing(s); setSheetOpen(true); };

  const answer = async (s: Streak, kept: boolean | null) => {
    const child = kids.find(k => k.id === s.child_id);
    try {
      const result = await markDay({ streakId: s.id, date: today, kept });
      if (result.stars_delta > 0) {
        const unit = s.moment === "night" ? "nights" : "days";
        toast.success(`${child?.name ?? "They"} did it!`, {
          description: `${s.target_days} ${unit} in a row: ${s.name}. ★ ${result.stars_delta} added.`,
          icon: "⭐",
        });
      } else if (result.stars_delta < 0) {
        toast(`★ ${-result.stars_delta} taken back`, { description: `${s.name} is back to ${result.streak.current_count} of ${s.target_days}.` });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save that.");
    }
  };

  return (
    <section aria-label={heading ?? "Streaks"} className={cn("flex flex-col gap-2", className)}>
      {heading !== null && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <h2 className="text-16 font-semibold leading-[22px] text-focus-text">{heading}</h2>
          {shown.length > 0 && (
            <button
              type="button"
              onClick={openNew}
              className="inline-flex h-9 items-center gap-1 rounded-[12px] bg-focus-surface px-3 text-13 font-semibold text-focus-muted transition-colors hover:bg-focus-raised hover:text-focus-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
            >
              <Plus className="h-4 w-4" aria-hidden /> New
            </button>
          )}
        </div>
      )}

      {!loading && shown.length === 0 ? (
        <button
          type="button"
          onClick={openNew}
          className="flex w-full items-center gap-3 rounded-[18px] border-[1.5px] border-dashed border-focus-raised px-3.5 py-3 text-left transition-colors hover:bg-focus-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
        >
          <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
            <StreakStar state="filled" className="h-5 w-5" />
            <StreakStar state="filled" className="h-5 w-5" />
            <StreakStar state="next" className="h-5 w-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-14 font-semibold text-focus-text">Start a streak</span>
            <span className="text-12 leading-[17px] text-focus-muted">Stars for 5 nights in a row of staying in bed, brushing teeth, and more.</span>
          </span>
          <Plus className="h-5 w-5 shrink-0 text-focus-lime" aria-hidden />
        </button>
      ) : (
        shown.map(s => (
          <StreakCard
            key={s.id}
            streak={s}
            childName={kids.length > 1 ? kids.find(k => k.id === s.child_id)?.name : undefined}
            answer={answerOn(s.id, today)}
            today={today}
            busy={marking?.streakId === s.id}
            onAnswer={kept => answer(s, kept)}
            onEdit={() => openEdit(s)}
            outlined={heading === null}
          />
        ))
      )}

      {heading === null && shown.length > 0 && (
        <button
          type="button"
          onClick={openNew}
          className="mt-1 inline-flex h-12 items-center justify-center gap-1.5 rounded-[14px] bg-focus-surface text-14 font-semibold text-focus-muted transition-colors hover:bg-focus-raised hover:text-focus-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
        >
          <Plus className="h-4 w-4" aria-hidden /> New streak
        </button>
      )}

      <StreakSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        kids={kids}
        defaultChildId={kids.length === 1 ? kids[0].id : undefined}
        streak={editing}
        active={streaks.filter(s => s.is_active)}
        onCreate={createStreaks}
        onUpdate={updateStreak}
        onDelete={deleteStreak}
      />
    </section>
  );
};

/** The row of stars, the last one big: what the child sees, in miniature. */
export const StreakBeads = ({ count, target, className }: { count: number; target: number; className?: string }) => {
  const { reduce } = useMotionPrefs();
  const n = Math.max(2, target);
  const filled = Math.min(count, n - 1);
  const small = n > 7 ? "h-3.5 w-3.5" : "h-[18px] w-[18px]";
  return (
    <span className={cn("flex items-center gap-0.5", className)} aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const state = i < filled ? "filled" : i === filled ? "next" : i === n - 1 ? "prize" : "empty";
        return (
          <motion.span
            key={`${i}-${state}`}
            initial={reduce || state !== "filled" ? false : { scale: 0.3 }}
            animate={{ scale: 1 }}
            transition={springs.bouncy}
            className="flex"
          >
            <StreakStar state={state} className={i === n - 1 ? (n > 7 ? "h-5 w-5" : "h-6 w-6") : small} />
          </motion.span>
        );
      })}
    </span>
  );
};

const StreakCard = ({
  streak,
  childName,
  answer,
  today,
  busy,
  onAnswer,
  onEdit,
  outlined,
}: {
  streak: Streak;
  childName?: string;
  answer?: StreakDay;
  today: string;
  busy: boolean;
  onAnswer: (kept: boolean | null) => void;
  onEdit: () => void;
  /** Inside a sheet, which is the card's own colour. */
  outlined?: boolean;
}) => {
  const Icon = getTaskIconComponent(streak.name, streak.icon);
  const night = streak.moment === "night";
  const unit = night ? "nights" : "days";
  // A night streak started today has no night behind it to ask about yet.
  const startsTomorrow = night && toPSTDateString(streak.created_at) === today && !answer;
  const question = `${checkInLabel(streak.moment)}?`;

  return (
    <div className={cn("flex flex-col gap-3 rounded-[18px] bg-focus-sheet p-3", outlined && "border border-focus-surface", !streak.is_active && "opacity-70")}>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`${streak.name}${childName ? ` for ${childName}` : ""}: ${streak.current_count} of ${streak.target_days}. Edit`}
        className="-m-1 flex items-center gap-3 rounded-[14px] p-1 text-left transition-colors hover:bg-focus-surface/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-focus-bg text-focus-amber" aria-hidden>
          <Icon className="h-6 w-6" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[15px] font-semibold leading-5 text-focus-text">{streak.name}</span>
            {childName && (
              <span className="shrink-0 rounded-full bg-focus-lavender/20 px-2 py-0.5 text-12 font-semibold text-focus-lavender">{childName}</span>
            )}
            {!streak.is_active && (
              <span className="shrink-0 rounded-full bg-focus-surface px-2 py-0.5 text-12 font-semibold text-focus-muted">Paused</span>
            )}
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <StreakBeads count={streak.current_count} target={streak.target_days} />
            <span className="text-12 text-focus-muted">
              {streak.current_count} of {streak.target_days} {unit} · ★ {streak.reward_stars}
            </span>
          </span>
        </span>
      </button>

      {streak.is_active && (
        <div className="flex min-h-11 items-center justify-between gap-2 border-t border-focus-bg pt-3">
          {startsTomorrow ? (
            <p className="text-13 text-focus-muted">First check-in tomorrow morning.</p>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              {answer ? (
                <motion.div
                  key="answered"
                  className="flex w-full items-center justify-between gap-2"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  <p className="flex min-w-0 items-center gap-1.5 text-13 text-focus-muted">
                    {answer.kept ? (
                      <><Check className="h-4 w-4 shrink-0 text-focus-mint" aria-hidden /><span className="truncate">{checkInLabel(streak.moment)}: yes</span></>
                    ) : (
                      <span className="truncate">{checkInLabel(streak.moment)}: not this time</span>
                    )}
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAnswer(null)}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[12px] px-2.5 text-13 font-semibold text-focus-muted transition-colors hover:bg-focus-surface hover:text-focus-text disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
                  >
                    <Undo2 className="h-4 w-4" aria-hidden /> Undo
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="ask"
                  className="flex w-full items-center justify-between gap-2"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  <p className="min-w-0 truncate text-14 font-semibold text-focus-text">{question}</p>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onAnswer(false)}
                      className="h-11 rounded-[12px] bg-focus-surface px-3 text-13 font-semibold text-focus-muted transition-colors hover:bg-focus-raised hover:text-focus-text disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
                    >
                      Not this time
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onAnswer(true)}
                      className="inline-flex h-11 items-center gap-1.5 rounded-[12px] bg-focus-lime px-4 text-13 font-semibold text-focus-bg transition-colors hover:bg-focus-lime/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
                    >
                      <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden /> Yes
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  );
};

export default StreaksSection;
