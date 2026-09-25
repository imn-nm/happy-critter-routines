import { supabase } from '@/integrations/supabase/client';
import { calendarErrorMessage, recordCalendarSync } from '@/utils/calendarSyncStatus';

let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced, best-effort push to Google Calendar after a calendar-relevant
 * edit (parent event, holiday, or day note). A burst of edits collapses into
 * one sync call a few seconds after the last change.
 *
 * No toast: when no calendar is connected the function returns "Calendar
 * not connected" and nothing should surface. The outcome is recorded, so
 * Settings can show when a sync last worked, or that it stopped working.
 */
export const scheduleCalendarAutoSync = (householdId?: string | null) => {
  if (!householdId) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    // invoke() reports HTTP errors in its result rather than throwing, so a
    // .catch() alone never saw a failed sync.
    supabase.functions
      .invoke('google-calendar-sync', { body: { household_id: householdId } })
      .then(async ({ error }) => {
        if (!error) return recordCalendarSync(householdId, true);
        const message = await calendarErrorMessage(error);
        if (!/not connected/i.test(message)) recordCalendarSync(householdId, false, message);
      })
      .catch(async (e) => recordCalendarSync(householdId, false, await calendarErrorMessage(e)));
  }, 4000);
};
