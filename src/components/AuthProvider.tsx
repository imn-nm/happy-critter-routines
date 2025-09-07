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

  return <>{children}</>;
};

export default AuthProvider;