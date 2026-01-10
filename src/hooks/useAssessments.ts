import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { z } from 'zod';

// Zod schemas for assessment input validation
const scoreSchema = z.number().min(0).max(100).optional();

const diagnosticResultsSchema = z.object({
  dyslexia_probability_index: scoreSchema,
  adhd_probability_index: scoreSchema,
  dysgraphia_probability_index: scoreSchema,
  voice_fluency_score: z.number().min(0).max(100).optional(),
  voice_prosody_score: z.number().min(0).max(100).optional(),
  overall_risk_level: z.enum(['low', 'medium', 'high']).optional(),
});

export interface DiagnosticResult {
  id: string;
  student_id: string;
  clinician_id: string;
  session_id: string;
  overall_risk_level: string | null;
  dyslexia_probability_index: number | null;
  adhd_probability_index: number | null;
  dysgraphia_probability_index: number | null;
  voice_fluency_score: number | null;
  voice_prosody_score: number | null;
  created_at: string;
}

export interface DiagnosticResultWithStudent extends DiagnosticResult {
  students: {
    name: string;
    age: number;
    grade: string;
  } | null;
}

export function useAssessments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all diagnostic results with student info
  const assessmentsQuery = useQuery({
    queryKey: ['diagnostic_results', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diagnostic_results')
        .select(`
          *,
          students (name, age, grade)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DiagnosticResultWithStudent[];
    },
    enabled: !!user,
  });

  // Create new diagnostic result
  const createDiagnosticResult = useMutation({
    mutationFn: async (input: {
      student_id: string;
      session_id: string;
      results?: {
        dyslexia_probability_index?: number;
        adhd_probability_index?: number;
        dysgraphia_probability_index?: number;
        voice_fluency_score?: number;
        voice_prosody_score?: number;
        overall_risk_level?: 'low' | 'medium' | 'high';
      };
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Validate input data
      z.string().uuid('Invalid student ID').parse(input.student_id);
      z.string().min(1).parse(input.session_id);
      
      const validatedResults = input.results 
        ? diagnosticResultsSchema.parse(input.results)
        : {};

      const { data, error } = await supabase
        .from('diagnostic_results')
        .insert({
          student_id: input.student_id,
          clinician_id: user.id,
          session_id: input.session_id,
          ...validatedResults,
        })
        .select()
        .single();

      if (error) throw error;
      return data as DiagnosticResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnostic_results'] });
    },
    onError: (error) => {
      if (error instanceof z.ZodError) {
        toast.error('Validation error: ' + error.errors.map(e => e.message).join(', '));
      } else {
        toast.error('Failed to create diagnostic result: ' + error.message);
      }
    },
  });

  // Update diagnostic result
  const updateDiagnosticResult = useMutation({
    mutationFn: async (input: {
      id: string;
      results: {
        dyslexia_probability_index?: number;
        adhd_probability_index?: number;
        dysgraphia_probability_index?: number;
        voice_fluency_score?: number;
        voice_prosody_score?: number;
        overall_risk_level?: 'low' | 'medium' | 'high';
      };
    }) => {
      // Validate input
      z.string().uuid('Invalid result ID').parse(input.id);
      const validatedResults = diagnosticResultsSchema.parse(input.results);

      const { error } = await supabase
        .from('diagnostic_results')
        .update(validatedResults)
        .eq('id', input.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnostic_results'] });
      toast.success('Assessment updated successfully');
    },
    onError: (error) => {
      if (error instanceof z.ZodError) {
        toast.error('Validation error: ' + error.errors.map(e => e.message).join(', '));
      } else {
        toast.error('Failed to update assessment: ' + error.message);
      }
    },
  });

  return {
    assessments: assessmentsQuery.data ?? [],
    isLoading: assessmentsQuery.isLoading,
    isError: assessmentsQuery.isError,
    error: assessmentsQuery.error,
    createDiagnosticResult,
    updateDiagnosticResult,
    refetch: assessmentsQuery.refetch
  };
}

export function useDiagnosticResults(studentId?: string) {
  return useQuery({
    queryKey: ['diagnostic_results', studentId],
    queryFn: async () => {
      if (!studentId) return null;
      
      const { data, error } = await supabase
        .from('diagnostic_results')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DiagnosticResult[];
    },
    enabled: !!studentId,
  });
}
