import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Redirect to auth page with return URL
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Check if email is verified for email/password users
  // OAuth users (Google) are auto-verified, so we check the provider
  const isOAuthUser = user.app_metadata?.provider === 'google';
  const isEmailVerified = user.email_confirmed_at !== null && user.email_confirmed_at !== undefined;
  
  if (!isOAuthUser && !isEmailVerified) {
    // Email not verified, redirect back to auth page
    return <Navigate to="/auth" state={{ from: location, unverified: true }} replace />;
  }

  return <>{children}</>;
}
