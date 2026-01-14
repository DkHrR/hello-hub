import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { z } from 'zod';
import type { Tables } from '@/integrations/supabase/types';

// Zod schemas for input validation - matches actual database schema
const studentInsertSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(100, 'First name must be less than 100 characters'),
  last_name: z.string().trim().min(1, 'Last name is required').max(100, 'Last name must be less than 100 characters'),
  grade_level: z.string().max(20, 'Grade must be less than 20 characters').nullable().optional(),
  date_of_birth: z.string().nullable().optional(),
  school: z.string().max(200, 'School name must be less than 200 characters').nullable().optional(),
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').nullable().optional(),
});

const studentUpdateSchema = studentInsertSchema.partial();

// Use the actual database type
type Student = Tables<'students'>;

export interface StudentInsert {
  first_name: string;
  last_name: string;
  grade_level?: string | null;
  date_of_birth?: string | null;
  school?: string | null;
  notes?: string | null;
}

export interface StudentUpdate {
  first_name?: string;
  last_name?: string;
  grade_level?: string | null;
  date_of_birth?: string | null;
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
        .eq('created_by', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createStudent = useMutation({
    mutationFn: async (student: StudentInsert) => {
      if (!user) throw new Error('Not authenticated');
      
      // Validate input data
      const validated = studentInsertSchema.parse(student);
      
      const { data, error } = await supabase
        .from('students')
        .insert([{
          first_name: validated.first_name,
          last_name: validated.last_name,
          grade_level: validated.grade_level || null,
          date_of_birth: validated.date_of_birth || null,
          school: validated.school || null,
          notes: validated.notes || null,
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
      if (error instanceof z.ZodError) {
        toast.error('Validation error: ' + error.errors.map(e => e.message).join(', '));
      } else {
        toast.error('Failed to add student: ' + error.message);
      }
    },
  });

  const updateStudent = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: StudentUpdate }) => {
      // Validate input data
      const validated = studentUpdateSchema.parse(updates);
      
      const { data, error } = await supabase
        .from('students')
        .update(validated)
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
      if (error instanceof z.ZodError) {
        toast.error('Validation error: ' + error.errors.map(e => e.message).join(', '));
      } else {
        toast.error('Failed to update student: ' + error.message);
      }
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

  // Helper to get full name
  const getStudentFullName = (student: Student): string => {
    return `${student.first_name} ${student.last_name}`.trim();
  };

  return {
    students: studentsQuery.data ?? [],
    isLoading: studentsQuery.isLoading,
    isError: studentsQuery.isError,
    error: studentsQuery.error,
    createStudent,
    updateStudent,
    deleteStudent,
    getStudentFullName,
  };
}