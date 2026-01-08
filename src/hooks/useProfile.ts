import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { z } from 'zod';

// Zod schema for profile update validation
const profileUpdateSchema = z.object({
  full_name: z.string().trim().max(100, 'Name must be less than 100 characters').optional(),
  avatar_url: z.string().url('Invalid avatar URL').max(500, 'Avatar URL too long').nullable().optional(),
  organization: z.string().trim().max(200, 'Organization must be less than 200 characters').nullable().optional(),
});

// Match the actual database schema for profiles
export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  organization: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdate {
  full_name?: string;
  avatar_url?: string;
  organization?: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'educator' | 'clinician' | 'parent';
  created_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!user,
  });

  const rolesQuery = useQuery({
    queryKey: ['user_roles', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      return data as UserRole[];
    },
    enabled: !!user,
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: ProfileUpdate) => {
      if (!user) throw new Error('Not authenticated');
      
      // Validate input data
      const validated = profileUpdateSchema.parse(updates);
      
      const { data, error } = await supabase
        .from('profiles')
        .update(validated)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast.success('Profile updated successfully');
    },
    onError: (error) => {
      if (error instanceof z.ZodError) {
        toast.error('Validation error: ' + error.errors.map(e => e.message).join(', '));
      } else {
        toast.error('Failed to update profile: ' + error.message);
      }
    },
  });

  // Helper functions to check roles
  const hasRole = (role: 'admin' | 'educator' | 'clinician' | 'parent'): boolean => {
    return rolesQuery.data?.some(r => r.role === role) ?? false;
  };

  const isAdmin = hasRole('admin');
  const isEducator = hasRole('educator');
  const isClinician = hasRole('clinician');
  const isParent = hasRole('parent');

  return {
    profile: profileQuery.data,
    roles: rolesQuery.data ?? [],
    isLoading: profileQuery.isLoading || rolesQuery.isLoading,
    isError: profileQuery.isError,
    updateProfile,
    hasRole,
    isAdmin,
    isEducator,
    isClinician,
    isParent
  };
}
