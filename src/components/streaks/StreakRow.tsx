import StreakStar from "@/components/round/StreakStar";
import type { Streak } from "@/hooks/useStreaks";
import { getTaskIconComponent } from "@/utils/taskIcon";
import { cn } from "@/lib/utils";

/**
 * A streak as the child sees it where their stars live (the Rewards shop, and
 * the round display's Rewards page): the habit's picture and its row of
 * stars, the big one last. There's nothing to press; grown-ups answer on
 * their phone. Picture view drops the words and numbers and makes the stars
 * bigger.
 */
const StreakRow = ({ streak, picture = false, className }: { streak: Streak; picture?: boolean; className?: string }) => {
  const Icon = getTaskIconComponent(streak.name, streak.icon);
  const n = Math.max(2, streak.target_days);
  const filled = Math.min(streak.current_count, n - 1);
  return (
    <div
      role="img"
      aria-label={`${streak.name}: ${filled} of ${n} stars. The big star gives ${streak.reward_stars} stars.`}
      className={cn("flex items-center gap-3 rounded-[20px] bg-focus-surface p-3", className)}
    >
      <span className={cn("flex shrink-0 items-center justify-center rounded-[14px] bg-focus-bg text-focus-iris", picture ? "h-14 w-14" : "h-11 w-11")} aria-hidden>
        <Icon className={picture ? "h-8 w-8" : "h-6 w-6"} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        {!picture && <span className="truncate text-14 font-semibold text-focus-text">{streak.name}</span>}
        <span className="flex flex-wrap items-center gap-1" aria-hidden>
          {Array.from({ length: n }, (_, i) => {
            const last = i === n - 1;
            const state = i < filled ? "filled" : i === filled ? "next" : last ? "prize" : "empty";
            const size = last ? (picture ? "h-10 w-10" : "h-8 w-8") : picture ? "h-7 w-7" : n > 7 ? "h-4 w-4" : "h-5 w-5";
            return (
              <span key={i} className={cn("relative flex", size)}>
                <StreakStar state={state} className="h-full w-full" />
                {last && !picture && (
                  <span className={cn("absolute inset-0 flex items-center justify-center pt-[10%] text-[11px] font-bold tabular-nums", state === "prize" ? "text-focus-lime" : "text-focus-bg")}>
                    {streak.reward_stars}
                  </span>
                )}
              </span>
            );
          })}
        </span>
      </span>
    </div>
  );
};

export default StreakRow;
