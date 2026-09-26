import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';

const SetPasswordForm = () => {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
    } catch {
      // toast already shown
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-[14px] bg-focus-surface flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6 text-focus-lavender" />
          </div>
          <h1 className="text-24 font-bold text-focus-text">Set Your Password</h1>
          <p className="text-14 text-focus-muted">
            Choose a password so you can sign in with email on any device.
          </p>
        </div>

        <div className="bg-focus-surface rounded-[24px] p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {error && <p className="text-14 text-focus-coral">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">
              Set Password
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SetPasswordForm;
