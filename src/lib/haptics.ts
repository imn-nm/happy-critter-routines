/**
 * Short vibration cues for the child screen.
 *
 * Touch is the one sense the app wasn't using. A pat that buzzes back makes
 * the rabbit feel like it's really there, and a completion you can feel lands
 * harder than one you only see.
 *
 * Enablement rides along with the sound setting — a grown-up who turned the
 * sound off on a device almost certainly wants the buzzing off too — and every
 * cue is a no-op where the Vibration API is missing (all of iOS Safari), so
 * call sites never need to check.
 */

import { soundsEnabled } from "./sounds";

const canVibrate = (): boolean =>
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

const buzz = (pattern: number | number[]) => {
  if (!canVibrate() || !soundsEnabled() || prefersReducedMotion()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* some browsers throw when the document isn't focused */
  }
};

export const haptics = {
  /** The child touched the pet. Barely there — a heartbeat, not a notification. */
  tap: () => buzz(12),
  /** A stroke crossed the pet's back: the purr under your fingers. */
  purr: () => buzz([8, 40, 8]),
  /** A task is done. A single confident thump. */
  done: () => buzz(26),
  /** Everything is done, or a grown-up said yes. Little drum roll. */
  celebrate: () => buzz([18, 60, 18, 60, 42]),
};
