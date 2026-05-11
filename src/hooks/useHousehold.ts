import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Household {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  parent_pin: string | null;
}

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  role: 'owner' | 'parent';
  email?: string | null;
}

const randomToken = () => {
  // 24-char URL-safe token. Browser-only.
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export const useHousehold = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: household, isLoading } = useQuery({
    queryKey: ['household', user?.id],
    enabled: !!user,
    retry: false,
    queryFn: async (): Promise<Household | null> => {
      // Find the current user's household (we assume one for now).
      const { data: memberships, error } = await supabase
        .from('household_members')
        .select('household_id, role')
        .eq('user_id', user!.id)
        .limit(1);
      // If the table doesn't exist yet (migrations not applied), treat as
      // "no household" so the app can still boot. Real errors still surface.
      if (error) {
        if (/relation .* does not exist|schema cache/i.test(error.message)) return null;
        throw error;
      }
      if (!memberships?.length) return null;

      const { data: h, error: hErr } = await supabase
        .from('households')
        .select('*')
        .eq('id', memberships[0].household_id)
        .single();
      if (hErr) throw hErr;
      return h as Household;
    },
  });

  const { data: members } = useQuery({
    queryKey: ['household_members', household?.id],
    enabled: !!household,
    queryFn: async (): Promise<HouseholdMember[]> => {
      const { data, error } = await supabase
        .from('household_members')
        .select('household_id, user_id, role')
        .eq('household_id', household!.id);
      if (error) throw error;
      return data as HouseholdMember[];
    },
  });

  // Create a household for the current user (used right after sign-up).
  const createHousehold = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('not signed in');
      const { data: h, error } = await supabase
        .from('households')
        .insert([{ name: name || 'My Family', created_by: user.id }])
        .select()
        .single();
      if (error) throw error;
      const { error: mErr } = await supabase
        .from('household_members')
        .insert([{ household_id: h.id, user_id: user.id, role: 'owner' }]);
      if (mErr) throw mErr;
      return h as Household;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['household'] }),
  });

  const setParentPin = useMutation({
    mutationFn: async (pin: string) => {
      if (!household) throw new Error('no household');
      if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN must be 4–6 digits');
      const { error } = await supabase
        .from('households')
        .update({ parent_pin: pin, updated_at: new Date().toISOString() })
        .eq('id', household.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['household'] }),
    onError: (e: any) => toast.error(e?.message ?? 'Failed to save PIN'),
  });

  const createInvite = useMutation({
    mutationFn: async (email?: string) => {
      if (!user || !household) throw new Error('no household');
      const token = randomToken();
      const { data, error } = await supabase
        .from('household_invites')
        .insert([{
          household_id: household.id,
          token,
          email: email ?? null,
          invited_by: user.id,
        }])
        .select()
        .single();
      if (error) throw error;
      const url = `${window.location.origin}/accept-invite?invite=${encodeURIComponent(token)}`;
      return { ...data, url };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['household_invites'] });
      toast.success('Invite link created');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to create invite'),
  });

  const redeemInvite = useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc('redeem_household_invite', {
        invite_token: token,
      });
      if (error) throw error;
      return data as string; // household_id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['household'] });
      toast.success('Joined household');
    },
    onError: (e: any) => toast.error(e.message ?? 'Invite invalid or expired'),
  });

  return {
    household,
    members,
    isLoading,
    createHousehold: createHousehold.mutateAsync,
    createInvite: createInvite.mutateAsync,
    redeemInvite: redeemInvite.mutateAsync,
    setParentPin: setParentPin.mutateAsync,
    isSettingPin: setParentPin.isPending,
  };
};
