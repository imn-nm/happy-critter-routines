import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Calendar scope is requested optionally — only if the user clicks
// "Connect Google Calendar". For plain sign-in we just want profile + email.
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';

// Dev fallback so the existing test flow keeps working when explicitly enabled.
// Dev server only: a production build must never sign visitors into the
// shared test account, whatever the local .env says.
const DEV_AUTOLOGIN = import.meta.env.DEV && import.meta.env.VITE_DEV_AUTOLOGIN === 'true';

// Hand the session token to realtime *before* the app renders any screen that
// subscribes. Otherwise a channel joined during page load goes out with no
// token, the server registers it as anon, and RLS hides every row from it —
// supabase-js only re-sends the token to joined channels when it changes.
const syncRealtimeAuth = (token?: string) => {
  if (token) supabase.realtime.setAuth(token);
};

// "Set a new password" mode is one app-wide fact, not per useAuth() call:
// AuthProvider shows the form from its own instance, and the form updates the
// password through another, so a per-instance flag left the form up forever.
let recoveryFlag = false;
const recoveryListeners = new Set<(on: boolean) => void>();
const setRecovery = (on: boolean) => {
  recoveryFlag = on;
  recoveryListeners.forEach(l => l(on));
};

export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(recoveryFlag);
  useEffect(() => {
    recoveryListeners.add(setRecoveryMode);
    return () => {
      recoveryListeners.delete(setRecoveryMode);
    };
  }, []);
  const { toast } = useToast();

  const signInWithGoogle = async (opts?: { withCalendarScope?: boolean; redirectTo?: string }) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: opts?.redirectTo ?? `${window.location.origin}/`,
        scopes: opts?.withCalendarScope ? GOOGLE_CALENDAR_SCOPE : undefined,
        queryParams: opts?.withCalendarScope
          ? { access_type: 'offline', prompt: 'consent' }
          : undefined,
      },
    });
    if (error) {
      toast({ title: 'Google sign-in failed', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: 'Sign-in failed', description: error.message, variant: 'destructive' });
      throw error;
    }
    setUser(data.user);
    return data.user;
  };

  /** `redirectTo`: where the confirmation email's link lands (e.g. back to an invite). */
  const signUpWithEmail = async (email: string, password: string, fullName?: string, redirectTo?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo ?? `${window.location.origin}/`,
        data: fullName ? { full_name: fullName } : undefined,
      },
    });
    if (error) {
      toast({ title: 'Sign-up failed', description: error.message, variant: 'destructive' });
      throw error;
    }
    if (data.user && !data.session) {
      toast({
        title: 'Check your email',
        description: 'We sent a confirmation link to finish creating your account.',
      });
    }
    return data.user;
  };

  // Legacy dev auto-login, only fires when VITE_DEV_AUTOLOGIN=true.
  const signInDevAuto = async () => {
    // Folded to '' in production builds, so the test login never ships.
    const testEmail = import.meta.env.DEV ? 'test@taskie.app' : '';
    const testPassword = import.meta.env.DEV ? 'test123456' : '';
    if (!testEmail) return;
    let { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (error && error.message.includes('Invalid login credentials')) {
      const { data: signUpData } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: { data: { full_name: 'Test Parent' } },
      });
      data = signUpData;
    }
    setUser(data?.user ?? null);
    return data?.user ?? null;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) {
      toast({ title: 'Reset failed', description: error.message, variant: 'destructive' });
      throw error;
    }
    toast({
      title: 'Check your email',
      description: 'We sent a password reset link. Use it to set a password for email sign-in.',
    });
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: 'Password update failed', description: error.message, variant: 'destructive' });
      throw error;
    }
    setRecovery(false);
    toast({ title: 'Password set', description: 'You can now sign in with email and password.' });
  };

  const signOut = async () => {
    // This device only. The default ('global') ends every session on the
    // account, which signs the child's always-on screen out too.
    await supabase.auth.signOut({ scope: 'local' });
    setUser(null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      syncRealtimeAuth(session?.access_token);
      setUser(session?.user ?? null);
      if (!session?.user && DEV_AUTOLOGIN) {
        signInDevAuto().catch(() => {}).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      syncRealtimeAuth(session?.access_token);
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        setRecovery(true);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    user,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    updatePassword,
    recoveryMode,
    signOut,
  };
};
