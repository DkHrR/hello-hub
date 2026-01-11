import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { z } from 'zod';
import type { Tables } from '@/integrations/supabase/types';

// Use the actual assessment_results table type
type AssessmentResult = Tables<'assessment_results'>;

// Zod schemas for assessment input validation
const scoreSchema = z.number().min(0).max(100).optional();

const assessmentResultsSchema = z.object({
  overall_risk_score: scoreSchema,
  reading_fluency_score: scoreSchema,
  phonological_awareness_score: scoreSchema,
  attention_score: scoreSchema,
  visual_processing_score: scoreSchema,
});

export interface AssessmentResultWithStudent extends AssessmentResult {
  assessments: {
    student_id: string;
    students: {
      first_name: string;
      last_name: string;
      grade_level: string | null;
    } | null;
  } | null;
}

export function useAssessments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all assessment results with student info via assessments table
  const assessmentsQuery = useQuery({
    queryKey: ['assessment_results', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assessment_results')
        .select(`
          *,
          assessments!inner (
            student_id,
            assessor_id,
            students (first_name, last_name, grade_level)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as AssessmentResultWithStudent[];
    },
    enabled: !!user,
  });

  // Create new assessment result - requires an existing assessment
  const createAssessmentResult = useMutation({
    mutationFn: async (input: {
      assessment_id: string;
      results?: {
        overall_risk_score?: number;
        reading_fluency_score?: number;
        phonological_awareness_score?: number;
        attention_score?: number;
        visual_processing_score?: number;
      };
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Validate input data
      z.string().uuid('Invalid assessment ID').parse(input.assessment_id);
      
      const validatedResults = input.results 
        ? assessmentResultsSchema.parse(input.results)
        : {};

      const { data, error } = await supabase
        .from('assessment_results')
        .insert({
          assessment_id: input.assessment_id,
          ...validatedResults,
        })
        .select()
        .single();

      if (error) throw error;
      return data as AssessmentResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessment_results'] });
    },
    onError: (error) => {
      if (error instanceof z.ZodError) {
        toast.error('Validation error: ' + error.errors.map(e => e.message).join(', '));
      } else {
        toast.error('Failed to create assessment result: ' + error.message);
      }
    },
  });

  return {
    assessments: assessmentsQuery.data ?? [],
    isLoading: assessmentsQuery.isLoading,
    isError: assessmentsQuery.isError,
    error: assessmentsQuery.error,
    createAssessmentResult,
    refetch: assessmentsQuery.refetch
  };
}

export function useAssessmentResults(studentId?: string) {
  return useQuery({
    queryKey: ['assessment_results', 'student', studentId],
    queryFn: async () => {
      if (!studentId) return null;
      
      // Get assessment results via the assessments table relationship
      const { data, error } = await supabase
        .from('assessment_results')
        .select(`
          *,
          assessments!inner (student_id)
        `)
        .eq('assessments.student_id', studentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as AssessmentResult[];
    },
    enabled: !!studentId,
  });
}