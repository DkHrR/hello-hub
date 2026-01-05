import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

  const studentsQuery = useQuery({
    queryKey: ['students', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const assessmentsQuery = useQuery({
    queryKey: ['assessments_with_results', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assessments')
        .select(`
          *,
          assessment_results (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Calculate risk levels from assessment results
  const getRiskLevel = (riskScore: number | null): 'low' | 'medium' | 'high' => {
    if (riskScore === null) return 'low';
    if (riskScore >= 0.6) return 'high';
    if (riskScore >= 0.3) return 'medium';
    return 'low';
  };

  // Map students with their risk levels from latest assessment
  const studentsWithScores: StudentWithRisk[] = studentsQuery.data?.map(student => {
    // Find latest assessment for this student
    const studentAssessments = assessmentsQuery.data?.filter(a => a.student_id === student.id) ?? [];
    const latestAssessment = studentAssessments[0];
    const latestResult = latestAssessment?.assessment_results?.[0];
    
    const riskLevel = getRiskLevel(latestResult?.overall_risk_score ?? null);
    
    return {
      id: student.id,
      name: `${student.first_name} ${student.last_name}`,
      grade: student.grade_level ?? 'N/A',
      risk: riskLevel,
      score: latestResult?.overall_risk_score ? latestResult.overall_risk_score * 100 : 0,
      lastAssessed: latestResult?.created_at 
        ? new Date(latestResult.created_at).toLocaleDateString()
        : 'Never',
    };
  }) ?? [];

  const stats: DashboardStats = {
    totalStudents: studentsQuery.data?.length ?? 0,
    totalAssessments: assessmentsQuery.data?.filter(a => a.status === 'completed').length ?? 0,
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
    isLoading: studentsQuery.isLoading || assessmentsQuery.isLoading,
    error: studentsQuery.error || assessmentsQuery.error,
    refetch: () => {
      studentsQuery.refetch();
      assessmentsQuery.refetch();
    },
  };
}
