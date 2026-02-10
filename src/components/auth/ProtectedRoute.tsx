import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, profile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // OAuth users (Google) bypass email verification
  const isOAuthUser = user.app_metadata?.provider === 'google';
  // Use profile.email_verified (custom SMTP flag) as source of truth
  const isEmailVerified = profile?.email_verified === true;
  
  if (!isOAuthUser && !isEmailVerified) {
    return <Navigate to="/auth" state={{ from: location, unverified: true }} replace />;
  }

  return <>{children}</>;
}
