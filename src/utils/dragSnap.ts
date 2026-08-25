/**
 * Drop placement for timeline drag & drop.
 *
 * Guarantees a dropped task never overlaps another timed task by working in
 * terms of *free gaps* instead of adjusting a proposed time against one
 * neighbor at a time. The task is placed inside a gap that actually fits it;
 * within the gap the start is clamped, magnet-snapped to the adjacent task
 * edges (previous task's end / next task's start), or aligned to a 5-minute
 * grid. If no gap on the day fits the task, the drop is rejected (null).
 */

export interface OccupiedBlock {
  start: number; // minutes since midnight
  end: number;
}

/** Within this many minutes of a gap edge, the drop magnetically snaps to it. */
export const EDGE_SNAP_MINUTES = 15;
/** Free-position drops align to this grid when not edge-snapped. */
export const GRID_MINUTES = 5;

const DAY_END = 24 * 60;

export interface DayBounds {
  /** Earliest minute a task may start (e.g. the child's wake time). Default 0. */
  dayStart?: number;
  /** Latest minute a task may end. Default 24:00. */
  dayEnd?: number;
}

/** Sort + merge overlapping/touching occupied blocks into a clean list. */
export const normalizeBlocks = (
  blocks: OccupiedBlock[],
  dayStart = 0,
  dayEnd = DAY_END,
): OccupiedBlock[] => {
  const sorted = blocks
    .filter(b => b.end > b.start)
    .map(b => ({
      start: Math.max(dayStart, b.start),
      end: Math.min(dayEnd, b.end),
    }))
    .filter(b => b.end > b.start)
    .sort((a, b) => a.start - b.start);

  const merged: OccupiedBlock[] = [];
  for (const b of sorted) {
    const last = merged[merged.length - 1];
    if (last && b.start <= last.end) {
      last.end = Math.max(last.end, b.end);
    } else {
      merged.push({ ...b });
    }
  }
  return merged;
};

/** Free gaps between occupied blocks, including before the first and after the last. */
export const buildFreeGaps = (
  occupied: OccupiedBlock[],
  bounds: DayBounds = {},
): OccupiedBlock[] => {
  const dayStart = bounds.dayStart ?? 0;
  const dayEnd = bounds.dayEnd ?? DAY_END;
  const blocks = normalizeBlocks(occupied, dayStart, dayEnd);
  const gaps: OccupiedBlock[] = [];
  let cursor = dayStart;
  for (const b of blocks) {
    if (b.start > cursor) gaps.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < dayEnd) gaps.push({ start: cursor, end: dayEnd });
  return gaps;
};

/**
 * Place a task of `duration` minutes as close to `proposedStart` as possible
 * without overlapping anything in `occupied`.
 *
 * Returns the resolved start minute, or null when no gap on the day can hold
 * the task (the caller should reject the drop and tell the user).
 */
export const resolveDropStart = (
  occupied: OccupiedBlock[],
  proposedStart: number,
  duration: number,
  bounds: DayBounds = {},
): number | null => {
  if (duration <= 0) duration = 5;
  const dayStart = bounds.dayStart ?? 0;
  const dayEnd = bounds.dayEnd ?? DAY_END;
  const gaps = buildFreeGaps(occupied, bounds).filter(g => g.end - g.start >= duration);
  if (gaps.length === 0) return null;

  // Pick the gap whose feasible start interval [gap.start, gap.end - duration]
  // is nearest to the proposal.
  let best: { gap: OccupiedBlock; clamped: number; dist: number } | null = null;
  for (const gap of gaps) {
    const lo = gap.start;
    const hi = gap.end - duration;
    const clamped = Math.min(hi, Math.max(lo, proposedStart));
    const dist = Math.abs(clamped - proposedStart);
    if (!best || dist < best.dist) best = { gap, clamped, dist };
  }
  const { gap, clamped } = best!;

  // Magnet snap to the adjacent task edges. A gap edge at the day boundary
  // isn't a task edge, so don't snap to it.
  const snapToStart =
    gap.start > dayStart && clamped - gap.start <= EDGE_SNAP_MINUTES;
  const snapToEnd =
    gap.end < dayEnd && gap.end - (clamped + duration) <= EDGE_SNAP_MINUTES;

  let start: number;
  if (snapToStart && snapToEnd) {
    // Close to both edges — snap to whichever is nearer.
    start =
      clamped - gap.start <= gap.end - (clamped + duration)
        ? gap.start
        : gap.end - duration;
  } else if (snapToStart) {
    start = gap.start;
  } else if (snapToEnd) {
    start = gap.end - duration;
  } else {
    // Free position inside the gap: align to the grid, then re-clamp so
    // rounding can't push the task out of the gap.
    start = Math.round(clamped / GRID_MINUTES) * GRID_MINUTES;
    start = Math.min(gap.end - duration, Math.max(gap.start, start));
  }

  return start;
};
