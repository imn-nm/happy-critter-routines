/**
 * Placement helper shared by the parent dashboard.
 *
 * A task saved without a fixed time still has to land somewhere on the day.
 * This used to be computed only at save time, so a parent who typed a title
 * and pressed Add got a task at a time they never saw. The same function now
 * runs when the form *opens*, seeding the time field, so the placement is
 * visible and editable before saving.
 */

interface PlaceableTask {
  scheduled_time?: string | null;
  duration?: number | null;
  is_active?: boolean;
}

/** Default assumed length for a task with no duration set. */
export const DEFAULT_SLOT_MINUTES = 30;

const toTimeString = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/** Round a minute-of-day up to the next 5-minute mark (for a tidy "now"). */
export const roundUpToGrid = (minutes: number, grid = 5) => Math.ceil(minutes / grid) * grid;

/**
 * First free stretch that fits `durationMinutes`, never earlier than
 * `notBeforeMinutes` (pass the current time when adding to today so a new
 * task can't land in the past). Falls back to straight after the last block.
 * Returns undefined when nothing constrains the day — no timed tasks and no
 * lower bound — so callers decide what an empty day means rather than getting
 * a made-up time.
 */
export function findNextFreeSlot(
  tasks: PlaceableTask[],
  durationMinutes: number = DEFAULT_SLOT_MINUTES,
  notBeforeMinutes?: number,
): string | undefined {
  const occupied = tasks
    .filter(t => t.is_active !== false && t.scheduled_time)
    .map(t => {
      const [h, m] = (t.scheduled_time || '09:00').slice(0, 5).split(':').map(Number);
      const start = h * 60 + m;
      return { start, end: start + (t.duration || DEFAULT_SLOT_MINUTES) };
    })
    .sort((a, b) => a.start - b.start);

  if (occupied.length === 0) {
    return notBeforeMinutes != null ? toTimeString(notBeforeMinutes) : undefined;
  }

  const fits = (candidate: number) => {
    const candidateEnd = candidate + durationMinutes;
    return !occupied.some(b => candidate < b.end && candidateEnd > b.start);
  };

  // "Now" wins whenever the current minute itself is free, even if the full
  // duration would brush the next task — the parent can shorten it, and the
  // conflict banner flags any overlap. Only skip ahead when now falls inside
  // another block.
  if (notBeforeMinutes != null) {
    const inside = occupied.some(b => notBeforeMinutes >= b.start && notBeforeMinutes < b.end);
    if (!inside) return toTimeString(notBeforeMinutes);
  }

  for (const block of occupied) {
    const candidate = Math.max(block.end, notBeforeMinutes ?? 0);
    if (fits(candidate)) return toTimeString(candidate);
  }

  return toTimeString(Math.max(occupied[occupied.length - 1].end, notBeforeMinutes ?? 0));
}
