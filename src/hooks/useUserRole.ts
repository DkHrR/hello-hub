import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

// Define the app roles that match the database enum
export type AppRole = 'clinician' | 'educator' | 'parent' | 'individual';

// Map UI role selection to database role
export const UI_ROLE_TO_DB_ROLE: Record<string, AppRole> = {
  individual: 'individual',
  school: 'educator',
  pediatrician: 'clinician',
};

export function useUserRole() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query to get user's roles from the user_roles table
  const rolesQuery = useQuery({
    queryKey: ['user_roles', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) {
        logger.error('Error fetching user roles', error);
        return [];
      }
      
      return data?.map(r => r.role as AppRole) ?? [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Mutation to set user role using the set_user_role RPC function
  const setRoleMutation = useMutation({
    mutationFn: async (role: AppRole) => {
      if (!user) throw new Error('Not authenticated');
      
      // Use the set_user_role RPC function for secure role assignment
      const { error } = await supabase.rpc('set_user_role', { _role: role });
      
      if (error) {
        if (error.message.includes('already set') || error.message.includes('duplicate') || error.code === '23505') {
          throw new Error('Your role has already been set. Contact support to change it.');
        }
        throw error;
      }
      
      return role;
    },
    onSuccess: (role) => {
      queryClient.invalidateQueries({ queryKey: ['user_roles', user?.id] });
      toast.success(`Role set to ${role} successfully`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to set role');
    },
  });

  // Check if user has any of the specified roles
  const hasRole = (role: AppRole): boolean => {
    return rolesQuery.data?.includes(role) ?? false;
  };

  // Check if user has any role (role selection complete)
  const hasAnyRole = (): boolean => {
    return (rolesQuery.data?.length ?? 0) > 0;
  };

  // Derived role checks - these use server-side data, not client-side logic
  const isClinician = hasRole('clinician');
  const isEducator = hasRole('educator');
  const isParent = hasRole('parent');
  const isIndividual = hasRole('individual') || hasRole('parent'); // Individual users mapped to parent role
  
  // Check if user has clinician-level access (clinician or educator can manage students)
  const hasClinicianAccess = isClinician || isEducator;

  return {
    roles: rolesQuery.data ?? [],
    isLoading: rolesQuery.isLoading,
    isError: rolesQuery.isError,
    hasRole,
    hasAnyRole,
    isClinician,
    isEducator,
    isParent,
    isIndividual,
    hasClinicianAccess,
    setRole: setRoleMutation.mutateAsync,
    isSettingRole: setRoleMutation.isPending,
  };
}
