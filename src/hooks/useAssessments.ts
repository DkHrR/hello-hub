import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

// Use the actual diagnostic_results table type
type DiagnosticResultRow = Tables<'diagnostic_results'>;

export interface DiagnosticResultWithStudent extends DiagnosticResultRow {
  students: {
    id: string;
    name: string;
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
          students (id, name, grade)
        `)
        .eq('clinician_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as DiagnosticResultWithStudent[];
    },
    enabled: !!user,
  });

  // Create new diagnostic result
  const createDiagnosticResult = useMutation({
    mutationFn: async (input: {
      student_id?: string;
      session_id: string;
      results?: Partial<DiagnosticResultRow>;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data: result, error: resultError } = await supabase
        .from('diagnostic_results')
        .insert({
          clinician_id: user.id,
          student_id: input.student_id || null,
          user_id: input.student_id ? null : user.id,
          session_id: input.session_id,
          ...input.results,
        })
        .select()
        .single();

      if (resultError) throw resultError;
      return result as DiagnosticResultRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnostic_results'] });
    },
    onError: (error) => {
      toast.error('Failed to create assessment: ' + error.message);
    },
  });

  return {
    assessments: assessmentsQuery.data ?? [],
    isLoading: assessmentsQuery.isLoading,
    isError: assessmentsQuery.isError,
    error: assessmentsQuery.error,
    createDiagnosticResult,
    refetch: assessmentsQuery.refetch
  };
}

export function useAssessmentResults(studentId?: string) {
  return useQuery({
    queryKey: ['diagnostic_results', 'student', studentId],
    queryFn: async () => {
      if (!studentId) return null;
      
      const { data, error } = await supabase
        .from('diagnostic_results')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as DiagnosticResultRow[];
    },
    enabled: !!studentId,
  });
}