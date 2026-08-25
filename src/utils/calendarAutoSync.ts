import { supabase } from '@/integrations/supabase/client';

let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced, best-effort push to Google Calendar after a calendar-relevant
 * edit (parent event, holiday, or day note). A burst of edits collapses into
 * one sync call a few seconds after the last change.
 *
 * Silent by design: when no calendar is connected the function returns
 * "Calendar not connected" and nothing should surface — the explicit
 * "Sync now" button in settings is where errors are shown to the parent.
 */
export const scheduleCalendarAutoSync = (householdId?: string | null) => {
  if (!householdId) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    supabase.functions
      .invoke('google-calendar-sync', { body: { household_id: householdId } })
      .catch(() => { /* best-effort */ });
  }, 4000);
};
