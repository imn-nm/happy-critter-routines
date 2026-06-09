import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useHousehold } from '@/hooks/useHousehold';
import { Skeleton } from '@/components/ui/skeleton';
import Login from '@/pages/Login';
import SetPasswordForm from '@/components/SetPasswordForm';

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthProvider = ({ children }: AuthProviderProps) => {
  const { user, loading, recoveryMode } = useAuth();
  // Only run household lookups once we're signed in (avoids 401s pre-auth).
  const enabled = !!user;
  const { household, isLoading: hhLoading, createHousehold } = useHousehold();
  const bootstrappedRef = useRef(false);

  // If this user has no household yet (fresh Google sign-up, no invite),
  // create one for them so they can start adding children right away.
  useEffect(() => {
    if (!enabled || hhLoading || household || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    createHousehold('My Family').catch(() => {
      // Likely a race with another tab; useHousehold will refetch.
      bootstrappedRef.current = false;
    });
  }, [enabled, hhLoading, household, createHousehold]);

  // Only block on household lookup briefly — if it fails (e.g. migrations not
  // applied), let the app render anyway so the user can still navigate.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-foreground text-lg font-medium text-glow">Setting up your account...</div>
          <div className="space-y-2.5 max-w-xs mx-auto">
            <Skeleton className="h-3 w-64 bg-white/10 rounded-full" />
            <Skeleton className="h-3 w-48 bg-white/10 rounded-full" />
            <Skeleton className="h-3 w-56 bg-white/10 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (recoveryMode) {
    return <SetPasswordForm />;
  }

  return <>{children}</>;
};

export default AuthProvider;
