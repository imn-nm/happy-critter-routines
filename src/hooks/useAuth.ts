import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Calendar scope is requested optionally — only if the user clicks
// "Connect Google Calendar". For plain sign-in we just want profile + email.
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';

// Dev fallback so the existing test flow keeps working when explicitly enabled.
const DEV_AUTOLOGIN = import.meta.env.VITE_DEV_AUTOLOGIN === 'true';

export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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

  const signUpWithEmail = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
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
    const testEmail = 'test@taskie.app';
    const testPassword = 'test123456';
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

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user && DEV_AUTOLOGIN) {
        signInDevAuto().catch(() => {}).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
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
    signOut,
  };
};
