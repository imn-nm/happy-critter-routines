import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useHousehold } from '@/hooks/useHousehold';

const AcceptInvite = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('invite');
  const { user, loading } = useAuth();
  const { redeemInvite } = useHousehold();
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (loading) return;
    if (!token) {
      setStatus('error');
      setMessage('No invite token in URL.');
      return;
    }
    if (!user) {
      navigate(`/login?invite=${encodeURIComponent(token)}`, { replace: true });
      return;
    }
    if (status !== 'idle') return;

    setStatus('working');
    redeemInvite(token)
      .then(() => {
        setStatus('done');
        setTimeout(() => navigate('/', { replace: true }), 1200);
      })
      .catch((e) => {
        setStatus('error');
        setMessage(e?.message ?? 'Invite invalid or expired.');
      });
  }, [token, user, loading, status, redeemInvite, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card rounded-3xl p-8 max-w-sm text-center space-y-4">
        {status === 'working' && (
          <p className="text-foreground">Joining household…</p>
        )}
        {status === 'done' && (
          <p className="text-foreground">You're in! Redirecting…</p>
        )}
        {status === 'error' && (
          <>
            <p className="text-foreground font-medium">Couldn't accept invite</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button onClick={() => navigate('/')}>Go home</Button>
          </>
        )}
      </div>
    </div>
  );
};

export default AcceptInvite;
