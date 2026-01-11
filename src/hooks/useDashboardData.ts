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

  // Query for students (only for clinicians/educators)
  const studentsQuery = useQuery({
    queryKey: ['students', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('created_by', user!.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && !isIndividual,
  });

  // Query for all assessment results (for clinicians - student assessments)
  const assessmentResultsQuery = useQuery({
    queryKey: ['assessment_results_dashboard', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assessment_results')
        .select(`
          *,
          assessments!inner (student_id, assessor_id)
        `)
        .eq('assessments.assessor_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && !isIndividual,
  });

  // Query for self-assessments (for individual users) - using assessments table
  const selfAssessmentsQuery = useQuery({
    queryKey: ['self_assessments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assessments')
        .select(`
          *,
          assessment_results (*)
        `)
        .eq('assessor_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Calculate risk levels from assessment results
  const getRiskLevel = (riskScore: number | null): 'low' | 'medium' | 'high' => {
    if (riskScore === null) return 'low';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 30) return 'medium';
    return 'low';
  };

  // Map students with their risk levels from latest assessment
  const studentsWithScores: StudentWithRisk[] = studentsQuery.data?.map(student => {
    // Find latest assessment result for this student
    const studentResults = assessmentResultsQuery.data?.filter(
      (r: any) => r.assessments?.student_id === student.id
    ) ?? [];
    const latestResult = studentResults[0];
    
    const riskScore = latestResult?.overall_risk_score ?? 0;
    const riskLevel = getRiskLevel(riskScore);
    
    return {
      id: student.id,
      name: `${student.first_name} ${student.last_name || ''}`.trim(),
      grade: student.grade_level ?? 'N/A',
      risk: riskLevel,
      score: riskScore,
      lastAssessed: latestResult?.created_at 
        ? new Date(latestResult.created_at).toLocaleDateString()
        : 'Never',
    };
  }) ?? [];

  const stats: DashboardStats = {
    totalStudents: studentsQuery.data?.length ?? 0,
    totalAssessments: assessmentResultsQuery.data?.length ?? 0,
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
    isLoading: studentsQuery.isLoading || assessmentResultsQuery.isLoading || selfAssessmentsQuery.isLoading,
    error: studentsQuery.error || assessmentResultsQuery.error || selfAssessmentsQuery.error,
    refetch: () => {
      studentsQuery.refetch();
      assessmentResultsQuery.refetch();
      selfAssessmentsQuery.refetch();
    },
  };
}