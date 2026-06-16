// Shared storage + constants for the free-time spinning wheel.
// Options are child-specific and persisted in localStorage, keyed by child id,
// so the parent dashboard and the child interface read/write the same wheel.

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

const storageKey = (childId: string) => `spinning-wheel:${childId}`;

export function getWheelOptions(childId?: string | null): string[] {
  if (!childId) return [];
  try {
    const raw = localStorage.getItem(storageKey(childId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((o) => typeof o === "string") : [];
  } catch {
    return [];
  }
}

export function setWheelOptions(childId: string, options: string[]) {
  try {
    localStorage.setItem(storageKey(childId), JSON.stringify(options));
  } catch {
    /* ignore quota/availability errors */
  }
}

export function hasWheel(childId?: string | null): boolean {
  return getWheelOptions(childId).length >= MIN_WHEEL_OPTIONS;
}
