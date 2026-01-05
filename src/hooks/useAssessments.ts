import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface AssessmentResult {
  id: string;
  assessment_id: string;
  overall_risk_score: number | null;
  reading_fluency_score: number | null;
  phonological_awareness_score: number | null;
  visual_processing_score: number | null;
  attention_score: number | null;
  recommendations: any;
  raw_data: any;
  created_at: string;
}

export interface Assessment {
  id: string;
  student_id: string;
  assessor_id: string;
  assessment_type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AssessmentWithResults extends Assessment {
  assessment_results: AssessmentResult[];
  students: {
    first_name: string;
    last_name: string;
    grade_level: string | null;
  } | null;
}

export function useAssessments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all assessments with results
  const assessmentsQuery = useQuery({
    queryKey: ['assessments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assessments')
        .select(`
          *,
          assessment_results (*),
          students (first_name, last_name, grade_level)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AssessmentWithResults[];
    },
    enabled: !!user,
  });

  // Create new assessment
  const createAssessment = useMutation({
    mutationFn: async (input: {
      student_id: string;
      assessment_type?: 'reading' | 'phonological' | 'visual' | 'comprehensive';
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('assessments')
        .insert({
          student_id: input.student_id,
          assessor_id: user.id,
          assessment_type: input.assessment_type || 'comprehensive',
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return data as Assessment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
    },
    onError: (error) => {
      toast.error('Failed to create assessment: ' + error.message);
    },
  });

  // Start assessment
  const startAssessment = useMutation({
    mutationFn: async (assessmentId: string) => {
      const { error } = await supabase
        .from('assessments')
        .update({ 
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .eq('id', assessmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
    },
  });

  // Complete assessment and save results
  const completeAssessment = useMutation({
    mutationFn: async (input: {
      assessmentId: string;
      results: {
        overall_risk_score?: number;
        reading_fluency_score?: number;
        phonological_awareness_score?: number;
        visual_processing_score?: number;
        attention_score?: number;
        recommendations?: string[];
        raw_data?: any;
      };
    }) => {
      // Update assessment status
      const { error: assessmentError } = await supabase
        .from('assessments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', input.assessmentId);

      if (assessmentError) throw assessmentError;

      // Save results
      const { data, error: resultError } = await supabase
        .from('assessment_results')
        .insert([{
          assessment_id: input.assessmentId,
          overall_risk_score: input.results.overall_risk_score,
          reading_fluency_score: input.results.reading_fluency_score,
          phonological_awareness_score: input.results.phonological_awareness_score,
          visual_processing_score: input.results.visual_processing_score,
          attention_score: input.results.attention_score,
          recommendations: input.results.recommendations ? JSON.parse(JSON.stringify(input.results.recommendations)) : null,
          raw_data: input.results.raw_data ? JSON.parse(JSON.stringify(input.results.raw_data)) : null
        }])
        .select()
        .single();

      if (resultError) throw resultError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      toast.success('Assessment completed and saved');
    },
    onError: (error) => {
      toast.error('Failed to save assessment: ' + error.message);
    },
  });

  // Save assessment results (separate from completion)
  const saveResults = useMutation({
    mutationFn: async (input: {
      assessment_id: string;
      overall_risk_score?: number;
      reading_fluency_score?: number;
      phonological_awareness_score?: number;
      visual_processing_score?: number;
      attention_score?: number;
      recommendations?: string[];
      raw_data?: any;
    }) => {
      const { data, error } = await supabase
        .from('assessment_results')
        .insert([{
          assessment_id: input.assessment_id,
          overall_risk_score: input.overall_risk_score,
          reading_fluency_score: input.reading_fluency_score,
          phonological_awareness_score: input.phonological_awareness_score,
          visual_processing_score: input.visual_processing_score,
          attention_score: input.attention_score,
          recommendations: input.recommendations ? JSON.parse(JSON.stringify(input.recommendations)) : null,
          raw_data: input.raw_data ? JSON.parse(JSON.stringify(input.raw_data)) : null
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
    },
  });

  return {
    assessments: assessmentsQuery.data ?? [],
    isLoading: assessmentsQuery.isLoading,
    isError: assessmentsQuery.isError,
    error: assessmentsQuery.error,
    createAssessment,
    startAssessment,
    completeAssessment,
    saveResults,
    refetch: assessmentsQuery.refetch
  };
}

export function useAssessmentResults(assessmentId?: string) {
  return useQuery({
    queryKey: ['assessment_results', assessmentId],
    queryFn: async () => {
      if (!assessmentId) return null;
      
      const { data, error } = await supabase
        .from('assessment_results')
        .select('*')
        .eq('assessment_id', assessmentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AssessmentResult[];
    },
    enabled: !!assessmentId,
  });
}
