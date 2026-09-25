import { supabase } from '@/integrations/supabase/client';

/**
 * The household this parent is using. A parent normally belongs to one, but
 * an invitee who set up a child before accepting can end up in two. Until
 * there's a switcher, every screen picks the one joined most recently (the
 * invite they just accepted), so they all agree. Throws when the lookup
 * fails, so callers never mistake an error for "no household".
 */
export const getMyHouseholdId = async (userId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.household_id ?? null;
};
