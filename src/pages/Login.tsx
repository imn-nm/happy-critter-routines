import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';

const Login = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteToken = params.get('invite') ?? undefined;
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  // After OAuth, redirect lands here with an invite query — useHousehold redeems it.
  const redirectTo = inviteToken
    ? `${window.location.origin}/accept-invite?invite=${encodeURIComponent(inviteToken)}`
    : `${window.location.origin}/`;

  const handleGoogle = async () => {
    setBusy(true);
    try {
      await signInWithGoogle({ redirectTo });
    } finally {
      setBusy(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'reset') {
        await resetPassword(email);
        setMode('signin');
        return;
      }
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        // Confirming the email must come back to the invite, not the home page.
        await signUpWithEmail(email, password, name || undefined, inviteToken ? redirectTo : undefined);
      }
      navigate(inviteToken ? `/accept-invite?invite=${encodeURIComponent(inviteToken)}` : '/');
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
          <h1 className="text-24 font-bold text-focus-text">
            {inviteToken ? 'Join Your Family' : mode === 'reset' ? 'Reset Password' : mode === 'signin' ? 'Welcome Back' : 'Create Your Account'}
          </h1>
          <p className="text-14 text-focus-muted">
            {inviteToken
              ? 'Sign in to accept the invite.'
              : 'Sign in to manage your family routines.'}
          </p>
        </div>

        <div className="bg-focus-surface rounded-[24px] p-6 space-y-4">
          {mode !== 'reset' && (
            <>
              <Button
                type="button"
                onClick={handleGoogle}
                disabled={busy}
                className="w-full gap-2"
                variant="outline"
              >
                <GoogleIcon /> Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-focus-raised" />
                </div>
                <div className="relative flex justify-center text-12 uppercase">
                  <span className="bg-focus-surface px-2 text-focus-muted">or</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleEmail} className="space-y-3">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {mode !== 'reset' && (
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy
                ? mode === 'reset' ? 'Sending…' : mode === 'signin' ? 'Signing in…' : 'Creating account…'
                : mode === 'reset' ? 'Send Reset Link' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <div className="pt-3 border-t border-focus-raised space-y-3">
            {mode === 'signin' && (
              <button
                type="button"
                onClick={() => setMode('reset')}
                className="w-full min-h-11 text-13 text-center"
              >
                <span className="text-focus-muted">Forgot password?</span>{' '}
                <span className="text-focus-lavender font-semibold hover:underline">Set One</span>
                <span className="block text-12 text-focus-muted mt-0.5">
                  Set one to enable email sign-in.
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="w-full min-h-11 text-13 text-center"
            >
              {mode === 'reset' ? (
                <span className="text-focus-lavender font-semibold hover:underline">Back to Sign In</span>
              ) : mode === 'signin' ? (
                <>
                  <span className="text-focus-muted">Don't have an account?</span>{' '}
                  <span className="text-focus-lavender font-semibold hover:underline">Sign Up</span>
                </>
              ) : (
                <>
                  <span className="text-focus-muted">Already have an account?</span>{' '}
                  <span className="text-focus-lavender font-semibold hover:underline">Sign In</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4-5.5 4-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.6 14.6 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12s4.2 9.4 9.4 9.4c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-2H12z"
    />
  </svg>
);

export default Login;
