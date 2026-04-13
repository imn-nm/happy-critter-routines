import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthProvider = ({ children }: AuthProviderProps) => {
  const { user, loading } = useAuth();

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
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm mx-auto text-center space-y-5">
          <div>
            <h1 className="text-xl font-bold text-foreground mb-2 text-glow">Authentication Setup</h1>
            <p className="text-sm text-muted-foreground">Disable email confirmation in Supabase to continue:</p>
          </div>

          <div className="glass-card rounded-2xl p-4 text-left text-sm text-foreground/80 space-y-1.5">
            <p>1. Go to your Supabase Dashboard</p>
            <p>2. Navigate to Authentication &rarr; Settings</p>
            <p>3. Disable "Confirm email"</p>
            <p>4. Save settings and refresh</p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="bg-primary text-primary-foreground px-6 py-2.5 rounded-2xl text-sm font-semibold hover:bg-primary/90 transition-all glow-purple"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthProvider;
