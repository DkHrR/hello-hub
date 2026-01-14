import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';

interface StudentWithRisk {
  id: string;
  name: string;
  grade: string;
  risk: 'low' | 'medium' | 'high';
  score: number;
  lastAssessed: string;
}

interface DashboardStats {
  totalStudents: number;
  totalAssessments: number;
  highRiskCount: number;
  moderateRiskCount: number;
  lowRiskCount: number;
}

export function useDashboardData() {
  const { user } = useAuth();
  const { isIndividual } = useUserRole();

  // Query for students (only for clinicians/educators) - using correct column names
  const studentsQuery = useQuery({
    queryKey: ['students', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, grade_level, created_at, updated_at')
        .eq('created_by', user!.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && !isIndividual,
  });

  // Query for assessments with results for clinician's students
  const assessmentsQuery = useQuery({
    queryKey: ['assessments_dashboard', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assessments')
        .select(`
          id,
          student_id,
          created_at,
          assessment_results (
            overall_risk_score,
            reading_fluency_score,
            attention_score
          )
        `)
        .eq('assessor_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && !isIndividual,
  });

  // Query for self-assessments (for individual users)
  const selfAssessmentsQuery = useQuery({
    queryKey: ['self_assessments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assessments')
        .select(`
          id,
          created_at,
          assessment_results (
            overall_risk_score,
            reading_fluency_score,
            attention_score
          )
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Calculate risk levels from assessment results
  const getRiskLevel = (riskScore: number | null): 'low' | 'medium' | 'high' => {
    if (!riskScore) return 'low';
    if (riskScore >= 0.7) return 'high';
    if (riskScore >= 0.4) return 'medium';
    return 'low';
  };

  // Map students with their risk levels from latest assessment
  const studentsWithScores: StudentWithRisk[] = studentsQuery.data?.map(student => {
    // Find latest assessment for this student
    const studentAssessments = assessmentsQuery.data?.filter(
      (a) => a.student_id === student.id
    ) ?? [];
    const latestAssessment = studentAssessments[0];
    const latestResult = latestAssessment?.assessment_results?.[0];
    
    const riskScore = latestResult?.overall_risk_score ?? 0;
    const riskLevel = getRiskLevel(riskScore);
    
    return {
      id: student.id,
      name: `${student.first_name} ${student.last_name}`.trim(),
      grade: student.grade_level ?? 'N/A',
      risk: riskLevel,
      score: Math.round((riskScore ?? 0) * 100),
      lastAssessed: latestAssessment?.created_at 
        ? new Date(latestAssessment.created_at).toLocaleDateString()
        : 'Never',
    };
  }) ?? [];

  const stats: DashboardStats = {
    totalStudents: studentsQuery.data?.length ?? 0,
    totalAssessments: assessmentsQuery.data?.length ?? 0,
    highRiskCount: studentsWithScores.filter(s => s.risk === 'high').length,
    moderateRiskCount: studentsWithScores.filter(s => s.risk === 'medium').length,
    lowRiskCount: studentsWithScores.filter(s => s.risk === 'low').length,
  };

  // Calculate risk distribution for charts
  const riskDistribution = [
    { name: 'Low Risk', value: stats.lowRiskCount || 0, color: 'hsl(var(--success))' },
    { name: 'Moderate Risk', value: stats.moderateRiskCount || 0, color: 'hsl(var(--warning))' },
    { name: 'High Risk', value: stats.highRiskCount || 0, color: 'hsl(var(--destructive))' },
  ];

  return {
    students: studentsWithScores,
    stats,
    riskDistribution,
    selfAssessments: selfAssessmentsQuery.data ?? [],
    isLoading: studentsQuery.isLoading || assessmentsQuery.isLoading || selfAssessmentsQuery.isLoading,
    error: studentsQuery.error || assessmentsQuery.error || selfAssessmentsQuery.error,
    refetch: () => {
      studentsQuery.refetch();
      assessmentsQuery.refetch();
      selfAssessmentsQuery.refetch();
    },
  };
}