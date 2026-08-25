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

/**
 * First gap after an existing block that fits `durationMinutes`, else straight
 * after the last block. Returns undefined when the day has nothing timed yet —
 * callers decide what an empty day means rather than getting a made-up time.
 */
export function findNextFreeSlot(
  tasks: PlaceableTask[],
  durationMinutes: number = DEFAULT_SLOT_MINUTES,
): string | undefined {
  const occupied = tasks
    .filter(t => t.is_active !== false && t.scheduled_time)
    .map(t => {
      const [h, m] = (t.scheduled_time || '09:00').slice(0, 5).split(':').map(Number);
      const start = h * 60 + m;
      return { start, end: start + (t.duration || DEFAULT_SLOT_MINUTES) };
    })
    .sort((a, b) => a.start - b.start);

  if (occupied.length === 0) return undefined;

  for (const block of occupied) {
    const candidate = block.end;
    const candidateEnd = candidate + durationMinutes;
    const overlaps = occupied.some(b => candidate < b.end && candidateEnd > b.start);
    if (!overlaps) return toTimeString(candidate);
  }

  return toTimeString(occupied[occupied.length - 1].end);
}
