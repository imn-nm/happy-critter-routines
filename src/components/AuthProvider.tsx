import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthProvider = ({ children }: AuthProviderProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-primary p-4 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-white text-xl">Setting up your account...</div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-64 bg-white/20" />
            <Skeleton className="h-4 w-48 bg-white/20" />
            <Skeleton className="h-4 w-56 bg-white/20" />
          </div>
        </div>
      </div>
    );
  }

  // Show setup instructions if no user
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-primary p-4 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center space-y-6">
          <div className="text-white">
            <h1 className="text-2xl font-bold mb-4">Authentication Setup Required</h1>
            <p className="mb-6">To use Taskie, please disable email confirmation in your Supabase settings:</p>
          </div>
          
          <div className="bg-white/10 p-4 rounded-lg text-left text-white text-sm">
            <ol className="space-y-2">
              <li>1. Go to your Supabase Dashboard</li>
              <li>2. Navigate to Authentication → Settings</li>
              <li>3. Disable "Confirm email"</li>
              <li>4. Save settings and refresh this page</li>
            </ol>
          </div>
          
          <button 
            onClick={() => window.location.reload()} 
            className="bg-white text-primary px-6 py-2 rounded-lg font-medium hover:bg-white/90 transition-colors"
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