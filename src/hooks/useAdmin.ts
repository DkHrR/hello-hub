import { useAuth } from '@/contexts/AuthContext';

const ADMIN_EMAIL = 'endtoend.encrypted64@gmail.com';

export function useAdmin() {
  const { user, loading } = useAuth();
  
  const isAdmin = !loading && !!user && user.email === ADMIN_EMAIL;
  
  return { isAdmin, isLoading: loading };
}
