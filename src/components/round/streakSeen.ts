/**
 * What this screen last showed of each streak, so a new bead or a finished
 * round is celebrated once, the next time the child looks, and a quiet reset
 * ("Not this time", or a parent's undo) is never celebrated at all. The
 * device keeps the same two numbers in its own storage.
 */
export interface StreakSeen {
  rounds: number;
  count: number;
}

const key = (streakId: string) => `petpals:streak-seen:${streakId}`;

export const readSeen = (streakId: string): StreakSeen | null => {
  try {
    const raw = window.localStorage.getItem(key(streakId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<StreakSeen>;
    return typeof v.rounds === "number" && typeof v.count === "number" ? { rounds: v.rounds, count: v.count } : null;
  } catch {
    return null;
  }
};

export const writeSeen = (streakId: string, seen: StreakSeen) => {
  try {
    window.localStorage.setItem(key(streakId), JSON.stringify(seen));
  } catch {
    /* storage unavailable: at worst a bead is cheered twice */
  }
};

/** Something to cheer since `seen`: more rounds is a round, more beads is a bead. */
export const celebrationFor = (now: StreakSeen, seen: StreakSeen | null): "bead" | "round" | null => {
  if (!seen) return null;
  if (now.rounds > seen.rounds) return "round";
  if (now.rounds === seen.rounds && now.count > seen.count) return "bead";
  return null;
};
