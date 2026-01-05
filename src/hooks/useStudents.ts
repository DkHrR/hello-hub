import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Match the actual database schema for students
export interface Student {
  id: string;
  created_by: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  grade_level: string | null;
  school: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentInsert {
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  grade_level?: string | null;
  school?: string | null;
  notes?: string | null;
}

export interface StudentUpdate {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string | null;
  grade_level?: string | null;
  school?: string | null;
  notes?: string | null;
}

export function useStudents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createStudent = useMutation({
    mutationFn: async (student: StudentInsert) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('students')
        .insert([{
          ...student,
          created_by: user.id,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add student: ' + error.message);
    },
  });

  const updateStudent = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: StudentUpdate }) => {
      const { data, error } = await supabase
        .from('students')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update student: ' + error.message);
    },
  });

  const deleteStudent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student removed successfully');
    },
    onError: (error) => {
      toast.error('Failed to remove student: ' + error.message);
    },
  });

  return {
    students: studentsQuery.data ?? [],
    isLoading: studentsQuery.isLoading,
    isError: studentsQuery.isError,
    error: studentsQuery.error,
    createStudent,
    updateStudent,
    deleteStudent,
  };
}
