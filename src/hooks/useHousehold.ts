import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { getMyHouseholdId } from '@/utils/household';

export interface Household {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  /** A PIN is set. The PIN itself is only ever checked on the server. */
  has_parent_pin: boolean;
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

  const { data: household, isLoading, isSuccess, isError, refetch } = useQuery({
    queryKey: ['household', user?.id],
    enabled: !!user,
    retry: 2,
    queryFn: async (): Promise<Household | null> => {
      const householdId = await getMyHouseholdId(user!.id);
      if (!householdId) return null;

      const { data: h, error: hErr } = await supabase
        .from('households')
        .select('*')
        .eq('id', householdId)
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
    // null turns the PIN off. Stored as a hash no device can read.
    mutationFn: async (pin: string | null) => {
      if (!household) throw new Error('no household');
      if (pin !== null && !/^\d{4,6}$/.test(pin)) throw new Error('PIN must be 4–6 digits');
      const { error } = await supabase.rpc('set_parent_pin', { p_household: household.id, p_pin: pin });
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
    /** `bringChildren`: move the children this parent set up alone into the family. */
    mutationFn: async ({ token, bringChildren = false }: { token: string; bringChildren?: boolean }) => {
      const { data, error } = await supabase.rpc('redeem_household_invite', {
        invite_token: token,
        bring_children: bringChildren,
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

  /** Check a PIN on the server. Throws when it can't be checked (offline). */
  const verifyParentPin = async (pin: string) => {
    if (!household) throw new Error('no household');
    const { data, error } = await supabase.rpc('verify_parent_pin', { p_household: household.id, p_pin: pin });
    if (error) throw error;
    return data === true;
  };

  return {
    household,
    verifyParentPin,
    members,
    isLoading,
    /** The lookup finished without an error (so a null household really is none). */
    isSuccess,
    /** The lookup failed (after retries). */
    isError,
    refetchHousehold: refetch,
    createHousehold: createHousehold.mutateAsync,
    createInvite: createInvite.mutateAsync,
    redeemInvite: redeemInvite.mutateAsync,
    setParentPin: setParentPin.mutateAsync,
    isSettingPin: setParentPin.isPending,
  };
};
