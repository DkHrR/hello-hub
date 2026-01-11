import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { z } from 'zod';
import { useUserRole } from './useUserRole';
import type { Tables } from '@/integrations/supabase/types';

// Zod schema for profile update validation
const profileUpdateSchema = z.object({
  full_name: z.string().trim().max(100, 'Name must be less than 100 characters').optional(),
  organization: z.string().trim().max(200, 'Organization must be less than 200 characters').nullable().optional(),
  avatar_url: z.string().url('Invalid URL').nullable().optional(),
});

// Use the actual database schema for profiles
type Profile = Tables<'profiles'>;

export interface ProfileUpdate {
  full_name?: string;
  organization?: string | null;
  avatar_url?: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Use the secure server-side role hook
  const { 
    isClinician, 
    isParent, 
    hasClinicianAccess, 
    isLoading: isRoleLoading 
  } = useUserRole();

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
      return data;
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
      return data;
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

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading || isRoleLoading,
    isError: profileQuery.isError,
    updateProfile,
    // Role checks now come from server-side user_roles table
    isClinician,
    isParent,
    hasClinicianAccess,
  };
}