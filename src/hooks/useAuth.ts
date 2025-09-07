import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Development auth - auto-login for testing
  const signInAnonymously = async () => {
    try {
      // Try to sign in with a test email
      const testEmail = 'test@taskie.app';
      const testPassword = 'test123456';
      
      let { data, error } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

      // If user doesn't exist, create one
      if (error && error.message.includes('Invalid login credentials')) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: testEmail,
          password: testPassword,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: 'Test Parent',
            }
          }
        });

        if (signUpError) throw signUpError;
        
        // For development, show message about email confirmation
        if (signUpData.user && !signUpData.session) {
          toast({
            title: "Account Created - Email Confirmation Required",
            description: "Please disable email confirmation in Supabase settings for development, or check your email to confirm.",
            variant: "destructive",
          });
          return null;
        }
        
        data = signUpData;
        
        toast({
          title: "Account Created",
          description: "Development account created successfully!",
        });
      } else if (error && error.message.includes('Email not confirmed')) {
        toast({
          title: "Email Not Confirmed",
          description: "Please disable 'Confirm email' in your Supabase Auth settings for development.",
          variant: "destructive",
        });
        return null;
      } else if (error) {
        throw error;
      }

      setUser(data.user);
      return data.user;
    } catch (error) {
      console.error('Auth error:', error);
      toast({
        title: "Authentication Error",
        description: "Failed to authenticate. Please check Supabase settings.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      
      // If no user, auto-login for development
      if (!session?.user) {
        signInAnonymously().catch(() => {
          // Don't retry automatically, let user see the error message
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    user,
    loading,
    signInAnonymously,
    signOut,
  };
};