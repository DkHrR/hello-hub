import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { z } from 'zod';
import type { Tables } from '@/integrations/supabase/types';

// Use the actual assessment_results table type
type AssessmentResultRow = Tables<'assessment_results'>;

// Zod schemas for assessment input validation
const scoreSchema = z.number().min(0).max(1).optional();

const assessmentResultSchema = z.object({
  overall_risk_score: scoreSchema,
  reading_fluency_score: scoreSchema,
  phonological_awareness_score: scoreSchema,
  visual_processing_score: scoreSchema,
  attention_score: scoreSchema,
});

export interface AssessmentResultWithStudent extends AssessmentResultRow {
  assessments: {
    student_id: string | null;
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
          assessments (
            student_id,
            students (first_name, last_name, grade_level)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as AssessmentResultWithStudent[];
    },
    enabled: !!user,
  });

  // Create new assessment with result
  const createAssessmentResult = useMutation({
    mutationFn: async (input: {
      student_id?: string;
      assessment_type?: 'reading' | 'phonological' | 'visual' | 'comprehensive';
      results?: {
        overall_risk_score?: number;
        reading_fluency_score?: number;
        phonological_awareness_score?: number;
        visual_processing_score?: number;
        attention_score?: number;
      };
    }) => {
      if (!user) throw new Error('Not authenticated');

      const validatedResults = input.results 
        ? assessmentResultSchema.parse(input.results)
        : {};

      // First create an assessment
      const { data: assessment, error: assessmentError } = await supabase
        .from('assessments')
        .insert({
          assessor_id: user.id,
          user_id: input.student_id ? null : user.id,
          student_id: input.student_id || null,
          assessment_type: input.assessment_type || 'comprehensive',
          status: 'completed',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (assessmentError) throw assessmentError;

      // Then create the assessment result
      const { data: result, error: resultError } = await supabase
        .from('assessment_results')
        .insert({
          assessment_id: assessment.id,
          ...validatedResults,
        })
        .select()
        .single();

      if (resultError) throw resultError;
      return result as AssessmentResultRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessment_results'] });
    },
    onError: (error) => {
      if (error instanceof z.ZodError) {
        toast.error('Validation error: ' + error.errors.map(e => e.message).join(', '));
      } else {
        toast.error('Failed to create assessment: ' + error.message);
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
      
      // Get assessments for this student first
      const { data: assessments, error: assessmentsError } = await supabase
        .from('assessments')
        .select('id')
        .eq('student_id', studentId);

      if (assessmentsError) throw assessmentsError;
      if (!assessments || assessments.length === 0) return [];

      const assessmentIds = assessments.map(a => a.id);

      // Then get results for those assessments
      const { data, error } = await supabase
        .from('assessment_results')
        .select('*')
        .in('assessment_id', assessmentIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as AssessmentResultRow[];
    },
    enabled: !!studentId,
  });
}