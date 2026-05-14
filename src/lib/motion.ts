import { useReducedMotion, type Transition, type Variants } from "framer-motion";

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
