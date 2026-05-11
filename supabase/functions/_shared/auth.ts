// Shared: verify the caller is a member of the household they're acting on.
// Uses the user's JWT (passed by the SDK as Authorization: Bearer) against
// supabase.auth.getUser, then checks household_members.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

export async function requireHouseholdMember(
  req: Request,
  householdId: string,
): Promise<{ userId: string; admin: SupabaseClient }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('missing auth');

  const admin = adminClient();
  const { data: userData, error } = await admin.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (error || !userData.user) throw new Error('invalid auth');

  const { data: m, error: mErr } = await admin
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!m) throw new Error('not a household member');

  return { userId: userData.user.id, admin };
}
