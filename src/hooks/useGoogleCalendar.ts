import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHousehold } from '@/hooks/useHousehold';
import { toast } from 'sonner';

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';

// Set right before signInWithOAuth and read after Supabase fires SIGNED_IN.
// Using sessionStorage rather than a URL query param makes the flow robust
// even when Supabase ignores `redirectTo` (e.g. URL not in the allowlist).
const PENDING_KEY = 'pending_calendar_connect_household';

export interface CalendarStatus {
  household_id: string;
  google_email: string | null;
  calendar_id: string | null;
  connected_at: string;
}

export const useGoogleCalendar = () => {
  const { user } = useAuth();
  const { household } = useHousehold();
  const qc = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ['google_calendar_status', household?.id],
    enabled: !!household,
    queryFn: async (): Promise<CalendarStatus | null> => {
      const { data, error } = await supabase.rpc('get_google_calendar_status', {
        hid: household!.id,
      });
      if (error) throw error;
      return (data?.[0] as CalendarStatus) ?? null;
    },
  });

  const connect = () => {
    if (!household) {
      toast.error('No household');
      return;
    }
    sessionStorage.setItem(PENDING_KEY, household.id);
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Supabase needs this exact URL in its Redirect URL allowlist.
        // We don't use a query param — the sessionStorage flag is the signal.
        redirectTo: `${window.location.origin}/settings`,
        scopes: GOOGLE_CALENDAR_SCOPE,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
  };

  // Fires on every SIGNED_IN; only acts when the pending flag is set, the
  // session has a fresh provider_token (Google access), and we know the
  // household to attach it to.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return;
        const pendingHouseholdId = sessionStorage.getItem(PENDING_KEY);
        if (!pendingHouseholdId) return;
        const providerToken = (session as any)?.provider_token;
        const providerRefresh = (session as any)?.provider_refresh_token;
        if (!providerToken) return;

        sessionStorage.removeItem(PENDING_KEY);
        try {
          const { error } = await supabase.functions.invoke(
            'google-calendar-connect',
            {
              body: {
                household_id: pendingHouseholdId,
                access_token: providerToken,
                refresh_token: providerRefresh ?? null,
              },
            },
          );
          if (error) throw error;
          qc.invalidateQueries({ queryKey: ['google_calendar_status'] });
          toast.success('Google Calendar connected');
        } catch (e: any) {
          toast.error(e?.message ?? 'Failed to connect calendar');
        }
      },
    );
    return () => subscription.unsubscribe();
  }, [qc]);

  const syncNow = useMutation({
    mutationFn: async () => {
      if (!household) throw new Error('No household');
      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
        body: { household_id: household.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) =>
      toast.success(`Synced ${data?.synced ?? 0} events to Google Calendar`),
    onError: (e: any) => toast.error(e.message ?? 'Sync failed'),
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!household) throw new Error('No household');
      const { error } = await supabase.functions.invoke('google-calendar-disconnect', {
        body: { household_id: household.id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['google_calendar_status'] });
      toast.success('Calendar disconnected');
    },
  });

  return {
    status,
    isLoading,
    isConnected: !!status,
    connect,
    syncNow: syncNow.mutateAsync,
    disconnect: disconnect.mutateAsync,
    syncing: syncNow.isPending,
  };
};
