import { cn } from "@/lib/utils";
import { formatDuration } from "@/utils/formatDuration";

/**
 * Formatting and class names shared by the Focus bottom sheets (see
 * SheetParts.tsx). Kept apart from the components so fast refresh works.
 */

/** "15:00" → "3:00 pm" */
export const fmtTime = (hhmm?: string) => {
  if (!hhmm) return "";
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
};

/** "15:00"–"19:00" → "3:00–7:00 pm"; mixed halves keep both ("11:00 am–1:00 pm"). */
export const fmtRange = (a: string, b: string) => {
  const sameHalf = (Number(a.slice(0, 2)) >= 12) === (Number(b.slice(0, 2)) >= 12);
  return sameHalf ? `${fmtTime(a).slice(0, -3)}–${fmtTime(b)}` : `${fmtTime(a)}–${fmtTime(b)}`;
};

/** 30 → "30 min", 90 → "1 h 30 min", 120 → "2 h" (same as everywhere else). */
export const fmtLen = (minutes: number) => formatDuration(minutes);

/**
 * Pinned to the bottom of the sheet's scroll area so the main action is
 * always reachable. Sticks into the scroll container's bottom padding so no
 * content shows beneath it.
 */
export const sheetFooterClass =
  "sticky -bottom-5 sm:-bottom-6 z-10 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 pt-3 pb-5 sm:pb-6 flex flex-col gap-2 backdrop-blur-xl bg-focus-sheet/90 border-t border-focus-raised";

/** Lavender when chosen, surface otherwise. Lime is kept for the save button. */
export const choiceClass = (selected: boolean, className?: string) =>
  cn(
    "min-h-11 min-w-0 flex items-center justify-center px-2.5 text-13 font-semibold leading-[18px] text-center transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender focus-visible:ring-offset-2 focus-visible:ring-offset-focus-sheet",
    "disabled:cursor-not-allowed disabled:opacity-40",
    selected
      ? "bg-focus-lavender text-focus-bg"
      : "bg-focus-surface text-focus-muted hover:enabled:bg-focus-raised hover:enabled:text-focus-text",
    className ?? "rounded-[12px]",
  );

export const tileClass =
  "flex-1 min-w-0 min-h-11 flex flex-col items-start justify-center gap-0.5 rounded-[12px] bg-focus-bg px-3 py-2 text-left transition-colors hover:bg-focus-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender";

