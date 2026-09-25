import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useHousehold } from '@/hooks/useHousehold';
import { supabase } from '@/integrations/supabase/client';

interface InvitePeek {
  status: 'ok' | 'expired' | 'used' | 'not_found';
  household_name?: string;
  invited_by?: string | null;
  email?: string | null;
  already_member?: boolean;
}

/**
 * An invite link says what it's for before anything happens: "Join the
 * Garcia family?". It used to join on page load, so the owner opening their
 * own link (to check it) used it up. An invite sent to an email only works
 * for that account.
 */
const AcceptInvite = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('invite');
  const { user, loading, signOut } = useAuth();
  const { redeemInvite } = useHousehold();
  const [peek, setPeek] = useState<InvitePeek | null>(null);
  const [status, setStatus] = useState<'looking' | 'ready' | 'joining' | 'done' | 'error'>('looking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!token) {
      setStatus('error');
      setMessage('This link is missing its invite.');
      return;
    }
    if (!user) {
      navigate(`/login?invite=${encodeURIComponent(token)}`, { replace: true });
      return;
    }
    let cancelled = false;
    supabase.rpc('peek_household_invite', { invite_token: token }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setStatus('error');
        setMessage("Couldn't look up this invite. Check the connection and try again.");
        return;
      }
      setPeek(data as unknown as InvitePeek);
      setStatus('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [token, user, loading, navigate]);

  const join = async () => {
    if (!token) return;
    setStatus('joining');
    try {
      await redeemInvite(token);
      setStatus('done');
      // A new co-parent belongs on the grown-up side, not the kids' picker.
      setTimeout(() => navigate('/parent', { replace: true }), 1000);
    } catch (e) {
      setStatus('error');
      const msg = (e as { message?: string })?.message ?? '';
      setMessage(msg.includes('wrong_account')
        ? `This invite was sent to ${peek?.email}. Sign in with that email to join.`
        : 'This invite has expired or was already used. Ask for a new link.');
    }
  };

  const wrongAccount = !!peek?.email && !!user?.email && peek.email.toLowerCase() !== user.email.toLowerCase();
  const family = peek?.household_name || 'this family';

  let body: React.ReactNode;
  if (status === 'looking') {
    body = <p className="text-foreground">Looking up your invite…</p>;
  } else if (status === 'joining') {
    body = <p className="text-foreground">Joining {family}…</p>;
  } else if (status === 'done') {
    body = <p className="text-foreground">You're in! Taking you to the family…</p>;
  } else if (status === 'error') {
    body = (
      <>
        <p className="text-foreground font-medium">Couldn't accept the invite</p>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button onClick={() => navigate('/parent')}>Go to the app</Button>
      </>
    );
  } else if (!peek || peek.status === 'not_found') {
    body = (
      <>
        <p className="text-foreground font-medium">This invite link doesn't work</p>
        <p className="text-sm text-muted-foreground">Check you copied the whole link, or ask for a new one.</p>
        <Button onClick={() => navigate('/parent')}>Go to the app</Button>
      </>
    );
  } else if (peek.already_member) {
    body = (
      <>
        <p className="text-foreground font-medium">You're already in {family}</p>
        <p className="text-sm text-muted-foreground">
          This link is for someone else to join. {peek.status === 'ok' ? "It hasn't been used, so you can still send it to them." : ''}
        </p>
        <Button onClick={() => navigate('/parent')}>Back to the app</Button>
      </>
    );
  } else if (peek.status !== 'ok') {
    body = (
      <>
        <p className="text-foreground font-medium">
          {peek.status === 'expired' ? 'This invite has expired' : 'This invite was already used'}
        </p>
        <p className="text-sm text-muted-foreground">Ask {peek.invited_by || 'the person who sent it'} for a new link.</p>
        <Button onClick={() => navigate('/parent')}>Go to the app</Button>
      </>
    );
  } else if (wrongAccount) {
    body = (
      <>
        <p className="text-foreground font-medium">This invite is for {peek.email}</p>
        <p className="text-sm text-muted-foreground">
          You're signed in as {user?.email}. Sign in with {peek.email} to join {family}.
        </p>
        <Button onClick={async () => { await signOut(); navigate(`/login?invite=${encodeURIComponent(token!)}`); }}>
          Use a different account
        </Button>
      </>
    );
  } else {
    body = (
      <>
        <span className="mx-auto w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
          <Users className="w-6 h-6 text-primary-light" />
        </span>
        <p className="text-lg text-foreground font-semibold">Join {family}?</p>
        <p className="text-sm text-muted-foreground">
          {peek.invited_by ? `${peek.invited_by} invited you` : 'You were invited'} to share the children's
          schedules and rewards. You're signed in as {user?.email}.
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={join}>Join {family}</Button>
          <Button variant="secondary" onClick={() => navigate('/parent')}>Not now</Button>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="glass-card rounded-3xl p-8 max-w-sm text-center space-y-4" role="status">
        {body}
      </div>
    </div>
  );
};

export default AcceptInvite;
