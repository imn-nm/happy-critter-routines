/**
 * PST/PDT date utilities.
 * All schedule logic must use these helpers so the app stays
 * aligned to Pacific Time regardless of the browser's timezone.
 */

// Setup's preview shows the child's screen at a chosen time of day ("what
// the morning looks like"). Only that page sets this, and clears it on leave.
let previewOffsetMs = 0;

/** Pretend it's `at` (a Pacific-time wall clock) until called with null. */
export const setPreviewClock = (at: Date | null) => {
  previewOffsetMs = at ? at.getTime() - new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })).getTime() : 0;
};

/** Returns a Date whose local-field values (getHours, getDay, etc.) reflect PST/PDT. */
export const getPSTDate = (): Date =>
  new Date(new Date(Date.now() + previewOffsetMs).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));

/** "yyyy-MM-dd" in Pacific Time */
export const getPSTDateString = (): string => {
  const d = getPSTDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** "HH:mm" in Pacific Time */
export const getPSTTimeString = (): string => {
  const d = getPSTDate();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Lowercase weekday name in Pacific Time, e.g. "wednesday" */
export const getPSTDayName = (): string => {
  const d = getPSTDate();
  return d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
};

/** "yyyy-MM-dd" in Pacific Time for a timestamp (e.g. a row's created_at). */
export const toPSTDateString = (at: Date | string): string => {
  const d = new Date(new Date(at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
