import { useReducedMotion, type Transition, type Variants } from "motion/react";

export const springs = {
  gentle: { type: "spring", stiffness: 120, damping: 18 } as const,
  snappy: { type: "spring", stiffness: 300, damping: 24 } as const,
  bouncy: { type: "spring", stiffness: 200, damping: 10 } as const,
} satisfies Record<string, Transition>;

export const durations = { quick: 0.15, base: 0.25, slow: 0.4 } as const;

export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const popInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
};

const INSTANT: Transition = { duration: 0 };

export function useMotionPrefs() {
  const reduce = useReducedMotion() ?? false;
  return {
    reduce,
    t: (transition: Transition): Transition => (reduce ? INSTANT : transition),
  };
}

// ── Popups (Focus redesign) ─────────────────────────────────
// Shared by dialogs, confirmation cards, popovers and menus so every
// overlay in the app moves the same way.

/** The blurred scrim behind every popup: a plain fade. */
export const overlayMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: "easeOut" } as Transition,
};

/** Bottom sheets: spring up from below, slide back down on close. */
export const sheetMotion = {
  initial: { y: "100%" },
  animate: { y: 0 },
  exit: { y: "100%" },
  transition: { type: "spring", stiffness: 380, damping: 38, mass: 0.9 } as Transition,
  exitTransition: { duration: 0.22, ease: [0.4, 0, 1, 1] } as Transition,
};

/** Centred confirmation cards: a small scale-and-fade. */
export const cardMotion = {
  initial: { opacity: 0, scale: 0.94, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 4 },
  transition: { type: "spring", stiffness: 420, damping: 32 } as Transition,
};

/** Anchored panels and menus: grow from the trigger's corner. */
export const popoverMotion = {
  initial: { opacity: 0, scale: 0.92, y: -6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: -4 },
  transition: { type: "spring", stiffness: 480, damping: 34 } as Transition,
};
