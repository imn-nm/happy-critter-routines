// Shared constants + helpers for the free-time spinning wheel.
// Options are child-specific and persisted in the database (children.
// spinning_wheel_options) so the parent dashboard and the child interface see
// the same wheel across devices and origins.

export const WHEEL_COLORS = [
  "#879bff", // iris
  "#38b2a4", // mint
  "#ff6666", // coral
  "#f0b542", // gold
  "#c084fc", // purple
  "#fb923c", // orange
  "#4ade80", // green
  "#60a5fa", // blue
];

export const MAX_WHEEL_OPTIONS = 8;
export const MIN_WHEEL_OPTIONS = 2;

/** Coerce a stored value (jsonb array, null, legacy shapes) into a clean string[]. */
export function normalizeWheelOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((o): o is string => typeof o === "string");
}

/** A wheel is usable once it has at least the minimum number of options. */
export function hasWheelOptions(options?: string[] | null): boolean {
  return (options?.length ?? 0) >= MIN_WHEEL_OPTIONS;
}

/**
 * What the wheel lands on until a grown-up adds their own. Free time comes
 * first on the wheel, so every child has one; all screen-free, like the rest
 * of free time.
 */
export const STARTER_WHEEL_OPTIONS = ["Draw", "Lego", "Read", "Play outside", "Puzzle", "Dance"];

/** The child's wheel: the parent's own options, or the starter ones until there are enough. */
export function wheelOptionsFor(value: unknown): string[] {
  const own = normalizeWheelOptions(value);
  return hasWheelOptions(own) ? own : STARTER_WHEEL_OPTIONS;
}
