/**
 * PST/PDT date utilities.
 * All schedule logic must use these helpers so the app stays
 * aligned to Pacific Time regardless of the browser's timezone.
 */

/** Returns a Date whose local-field values (getHours, getDay, etc.) reflect PST/PDT. */
export const getPSTDate = (): Date =>
  new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));

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
