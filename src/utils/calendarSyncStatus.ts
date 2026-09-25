/**
 * The last Google Calendar sync this device ran, so Settings can say "Last
 * synced 5 min ago" or that it stopped working, instead of showing
 * "Connected" forever while every sync fails. Kept per device (the device that
 * made the edit runs the sync); a server-side record would cover every device.
 */
export interface CalendarSyncStatus {
  at: string;
  ok: boolean;
  message?: string;
}

const key = (householdId: string) => `calendar-sync:${householdId}`;
const EVENT = 'calendar-sync-status';

export const recordCalendarSync = (householdId: string, ok: boolean, message?: string) => {
  try {
    window.localStorage.setItem(key(householdId), JSON.stringify({ at: new Date().toISOString(), ok, message }));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
};

export const readCalendarSync = (householdId: string): CalendarSyncStatus | null => {
  try {
    const raw = window.localStorage.getItem(key(householdId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const onCalendarSyncChange = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

/**
 * A parent-readable reason from a failed function call. FunctionsHttpError
 * hides the function's JSON body behind `context`; without this the parent
 * only ever sees "non-2xx status code".
 */
export const calendarErrorMessage = async (e: unknown): Promise<string> => {
  const err = e as { message?: string; context?: { json?: () => Promise<{ error?: string }> } } | null;
  let message = err?.message ?? 'Sync failed';
  try {
    const body = await err?.context?.json?.();
    if (body?.error) message = body.error;
  } catch {
    /* keep the generic message */
  }
  if (/invalid_grant|refresh failed|unauthor|expired|revoked/i.test(message)) {
    message = 'Google stopped letting us update this calendar. Reconnect to fix it.';
  }
  return message;
};
