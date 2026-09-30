/**
 * Ready-made streaks for the parent's "New streak" sheet. Names are what the
 * child sees on the round screen, so they stay short (one line is about 14
 * characters there). `icon` is a task icon key (utils/taskIcon.tsx).
 *
 * `moment` decides how the parent is asked: a night streak is answered in
 * the morning ("Last night"), a day streak about today.
 */
export type StreakMoment = "day" | "night";

export interface StreakPreset {
  key: string;
  name: string;
  icon: string;
  moment: StreakMoment;
}

export const STREAK_PRESETS: StreakPreset[] = [
  { key: "bed", name: "Stay in bed", icon: "bed", moment: "night" },
  { key: "dry", name: "Dry night", icon: "moon", moment: "night" },
  { key: "teeth", name: "Brush teeth", icon: "smile", moment: "day" },
  { key: "potty", name: "Use the potty", icon: "toilet", moment: "day" },
  { key: "veggies", name: "Try veggies", icon: "carrot", moment: "day" },
  { key: "dressed", name: "Get dressed", icon: "shirt", moment: "day" },
  { key: "kind", name: "Kind hands", icon: "heart", moment: "day" },
  { key: "tidy", name: "Tidy up", icon: "clean", moment: "day" },
];

/** How many days in a row. Short runs first: little ones do best with 3–5. */
export const STREAK_DAY_OPTIONS = [3, 5, 7, 10] as const;

export const DEFAULT_STREAK_DAYS = 5;

/** Longest name the round screen can fit on two lines. */
export const STREAK_NAME_MAX = 24;

/** "Last night" for night streaks, "Today" for day streaks. */
export const checkInLabel = (moment: string) => (moment === "night" ? "Last night" : "Today");
