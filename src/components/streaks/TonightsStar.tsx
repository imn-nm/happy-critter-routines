import { Moon } from "lucide-react";
import StreakRow from "@/components/streaks/StreakRow";
import { useStreaks } from "@/hooks/useStreaks";

/**
 * On the bedtime screens, a night streak's next star, waiting for the
 * morning: the reminder lands at the moment it matters ("stay in bed")
 * without a page of its own. Nothing shows for day streaks.
 */
const TonightsStar = ({ childId, picture = false }: { childId: string; picture?: boolean }) => {
  const { streaks } = useStreaks([childId]);
  const night = streaks.find(s => s.is_active && s.moment === "night");
  if (!night) return null;
  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      <p className="flex items-center justify-center gap-1.5 text-13 font-semibold text-focus-muted">
        <Moon className={picture ? "h-5 w-5 text-focus-lavender" : "h-4 w-4 text-focus-lavender"} aria-hidden />
        <span className={picture ? "sr-only" : undefined}>Tonight’s star</span>
      </p>
      <StreakRow streak={night} picture={picture} />
    </div>
  );
};

export default TonightsStar;
