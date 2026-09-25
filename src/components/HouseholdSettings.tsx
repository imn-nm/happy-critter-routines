import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Users, Mail, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHousehold } from '@/hooks/useHousehold';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PendingInvite {
  id: string;
  token: string;
  email: string | null;
  expires_at: string;
  created_at: string;
}

const copyLink = async (url: string) => {
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Invite link copied');
  } catch {
    toast.error(`Couldn't copy automatically — copy it manually: ${url}`);
  }
};

const HouseholdSettings = () => {
  const { user } = useAuth();
  const { household, members, createHousehold, createInvite } = useHousehold();
  const [inviteEmail, setInviteEmail] = useState('');
  const [latestUrl, setLatestUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  // Someone to remove (or yourself, to leave), waiting for a confirm.
  const [removing, setRemoving] = useState<{ userId: string; label: string } | null>(null);

  // Resolve member names from the profiles table (full_name || email).
  const memberIds = (members ?? []).map(m => m.user_id);
  const { data: profiles } = useQuery({
    queryKey: ['member_profiles', memberIds],
    enabled: memberIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', memberIds);
      if (error) throw error;
      return data;
    },
  });

  // Outstanding (unredeemed, unexpired) invites, so links survive a refresh.
  const { data: pendingInvites } = useQuery({
    queryKey: ['household_invites', household?.id],
    enabled: !!household,
    queryFn: async (): Promise<PendingInvite[]> => {
      const { data, error } = await supabase
        .from('household_invites')
        .select('id, token, email, expires_at, created_at')
        .eq('household_id', household!.id)
        .is('redeemed_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PendingInvite[];
    },
  });

  const memberLabel = (userId: string) => {
    const profile = profiles?.find(p => p.id === userId);
    const name = profile?.full_name || profile?.email;
    if (userId === user?.id) return name ? `${name} (You)` : 'You';
    return name ?? userId.slice(0, 8) + '…';
  };

  if (!household) {
    return (
      <section className="mx-sp-4 rounded-[28px] border border-[rgba(135,155,255,0.6)] bg-[rgba(135,155,255,0.2)] p-sp-4 flex flex-col gap-sp-3">
        <h2 className="text-14 font-medium text-iris-400 flex items-center gap-2">
          <Users className="w-4 h-4" /> Household
        </h2>
        <p className="text-14 text-fog-200">
          You're not in a household yet. Create one to share this account with a spouse or co-parent.
        </p>
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await createHousehold('My Family');
            } finally {
              setBusy(false);
            }
          }}
        >
          Create household
        </Button>
      </section>
    );
  }

  const isOwner = (members ?? []).some(m => m.user_id === user?.id && m.role === 'owner');

  // An invite link that's no longer wanted stops working right away.
  const cancelInvite = async (inviteId: string) => {
    const { error } = await supabase.from('household_invites').delete().eq('id', inviteId);
    if (error) {
      toast.error("Couldn't cancel that invite. Please try again.");
      return;
    }
    if (latestUrl && pendingInvites?.some(i => i.id === inviteId && latestUrl.includes(encodeURIComponent(i.token)))) setLatestUrl(null);
    qc.invalidateQueries({ queryKey: ['household_invites'] });
    toast.success('Invite cancelled');
  };

  // The owner can remove a co-parent; anyone can leave. Leaving signs you
  // out of this family's children on your devices; you get a fresh family.
  const removeMember = async (userId: string) => {
    const { error } = await supabase
      .from('household_members')
      .delete()
      .eq('household_id', household.id)
      .eq('user_id', userId);
    if (error) {
      toast.error("Couldn't do that. Please try again.");
      return;
    }
    const leaving = userId === user?.id;
    toast.success(leaving ? `You left ${household.name}` : 'Removed from the family');
    qc.invalidateQueries({ queryKey: ['household_members'] });
    if (leaving) {
      qc.invalidateQueries({ queryKey: ['household'] });
      window.location.assign('/parent');
    }
  };

  const generate = async () => {
    setBusy(true);
    try {
      const invite = await createInvite(inviteEmail.trim() || undefined);
      setLatestUrl(invite.url);
      setInviteEmail('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-sp-4 rounded-[28px] border border-[rgba(135,155,255,0.6)] bg-[rgba(135,155,255,0.2)] p-sp-4 flex flex-col gap-sp-3">
      <div className="flex items-center justify-between">
        <h2 className="text-14 font-medium text-iris-400 flex items-center gap-2">
          <Users className="w-4 h-4" /> Household
        </h2>
        <span className="text-12 text-fog-200">{household.name}</span>
      </div>

      <div className="flex flex-col gap-sp-1">
        <p className="text-12 text-fog-200">Members</p>
        <ul className="flex flex-col gap-1">
          {(members ?? []).map(m => (
            <li
              key={m.user_id}
              className="text-14 text-fog-50 px-sp-2 py-1 rounded-[12px] bg-[rgba(8,1,26,0.4)] flex justify-between"
            >
              <span className="truncate">{memberLabel(m.user_id)}</span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-fog-200 text-12">{m.role}</span>
                {m.user_id === user?.id
                  ? (members ?? []).length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRemoving({ userId: m.user_id, label: 'yourself' })}
                        className="tap-target text-12 text-coral-300 hover:text-coral-200"
                      >
                        Leave
                      </button>
                    )
                  : isOwner && m.role !== 'owner' && (
                      <button
                        type="button"
                        onClick={() => setRemoving({ userId: m.user_id, label: memberLabel(m.user_id) })}
                        className="tap-target text-12 text-coral-300 hover:text-coral-200"
                      >
                        Remove
                      </button>
                    )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-sp-2">
        <p className="text-12 text-fog-200">Invite your spouse</p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="email (optional)"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
          />
          <Button size="sm" onClick={generate} disabled={busy} className="gap-1.5">
            <Mail className="w-4 h-4" /> Invite
          </Button>
        </div>

        {latestUrl && (
          <div className="flex items-center gap-2 p-sp-2 rounded-[12px] bg-[rgba(8,1,26,0.4)]">
            <code className="text-12 text-fog-50 flex-1 truncate">{latestUrl}</code>
            <button
              type="button"
              onClick={() => copyLink(latestUrl)}
              className="tap-target shrink-0 w-11 h-11 flex items-center justify-center text-iris-400 hover:text-iris-300"
              aria-label="Copy invite link"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        )}

        {(pendingInvites ?? []).length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-12 text-fog-200">Pending invites</p>
            {pendingInvites!.map(inv => {
              const url = `${window.location.origin}/accept-invite?invite=${encodeURIComponent(inv.token)}`;
              return (
                <div
                  key={inv.id}
                  className="flex items-center gap-2 p-sp-2 rounded-[12px] bg-[rgba(8,1,26,0.4)]"
                >
                  <div className="flex-1 min-w-0">
                    <code className="text-12 text-fog-50 block truncate">{url}</code>
                    <p className="text-12 text-fog-200">
                      {inv.email ? `For ${inv.email} · ` : ''}
                      Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyLink(url)}
                    className="tap-target shrink-0 w-11 h-11 flex items-center justify-center text-iris-400 hover:text-iris-300"
                    aria-label="Copy invite link"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelInvite(inv.id)}
                    className="tap-target shrink-0 w-11 h-11 flex items-center justify-center text-fog-300 hover:text-coral-300"
                    aria-label="Cancel invite"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!removing} onOpenChange={(open) => { if (!open) setRemoving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {removing?.userId === user?.id ? `Leave ${household.name}?` : `Remove ${removing?.label}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.userId === user?.id
                ? "You won't see these children's schedules any more. Someone in the family can invite you back."
                : "They won't see the children's schedules any more. You can invite them again later."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removing && removeMember(removing.userId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing?.userId === user?.id ? 'Leave' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

export default HouseholdSettings;
