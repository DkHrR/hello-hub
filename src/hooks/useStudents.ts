import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { z } from 'zod';

// Zod schemas for input validation - matches actual database schema
const studentInsertSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name must be less than 200 characters'),
  age: z.number().int().min(1, 'Age must be at least 1').max(100, 'Age must be less than 100'),
  grade: z.string().max(20, 'Grade must be less than 20 characters'),
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').nullable().optional(),
});

const studentUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name must be less than 200 characters').optional(),
  age: z.number().int().min(1, 'Age must be at least 1').max(100, 'Age must be less than 100').optional(),
  grade: z.string().max(20, 'Grade must be less than 20 characters').optional(),
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').nullable().optional(),
  risk_level: z.enum(['low', 'moderate', 'high']).optional(),
});

// Match the actual database schema for students
export interface Student {
  id: string;
  clinician_id: string;
  name: string;
  age: number;
  grade: string;
  notes: string | null;
  risk_level: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentInsert {
  name: string;
  age: number;
  grade: string;
  notes?: string | null;
}

export interface StudentUpdate {
  name?: string;
  age?: number;
  grade?: string;
  notes?: string | null;
  risk_level?: 'low' | 'moderate' | 'high';
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
      return data as Student[];
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
        .insert({
          name: validated.name,
          age: validated.age,
          grade: validated.grade,
          notes: validated.notes ?? null,
          clinician_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Student;
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
      return data as Student;
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
