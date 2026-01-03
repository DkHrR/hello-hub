import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Student {
  id: string;
  name: string;
  grade: string;
  age: number;
  risk_level: string | null;
  created_at: string;
  updated_at: string;
}

interface DiagnosticResult {
  id: string;
  student_id: string;
  session_id: string;
  dyslexia_probability_index: number | null;
  adhd_probability_index: number | null;
  dysgraphia_probability_index: number | null;
  overall_risk_level: string | null;
  created_at: string;
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
      return data as Student[];
    },
    enabled: !!user,
  });

  const resultsQuery = useQuery({
    queryKey: ['diagnostic_results', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diagnostic_results')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DiagnosticResult[];
    },
    enabled: !!user,
  });

  const stats: DashboardStats = {
    totalStudents: studentsQuery.data?.length ?? 0,
    totalAssessments: resultsQuery.data?.length ?? 0,
    highRiskCount: studentsQuery.data?.filter(s => s.risk_level === 'high').length ?? 0,
    moderateRiskCount: studentsQuery.data?.filter(s => s.risk_level === 'medium').length ?? 0,
    lowRiskCount: studentsQuery.data?.filter(s => s.risk_level === 'low').length ?? 0,
  };

  // Calculate risk distribution for charts
  const riskDistribution = [
    { name: 'Low Risk', value: stats.lowRiskCount || 0, color: 'hsl(var(--success))' },
    { name: 'Moderate Risk', value: stats.moderateRiskCount || 0, color: 'hsl(var(--warning))' },
    { name: 'High Risk', value: stats.highRiskCount || 0, color: 'hsl(var(--destructive))' },
  ];

  // Get students with their latest session score
  const studentsWithScores = studentsQuery.data?.map(student => {
    const latestResult = resultsQuery.data?.find(r => r.student_id === student.id);
    const score = latestResult?.dyslexia_probability_index ?? 0;
    return {
      id: student.id,
      name: student.name,
      grade: student.grade,
      risk: student.risk_level || 'low',
      score,
      lastAssessed: latestResult?.created_at 
        ? new Date(latestResult.created_at).toLocaleDateString()
        : 'Never',
    };
  }) ?? [];

  return {
    students: studentsWithScores,
    sessions: resultsQuery.data ?? [],
    stats,
    riskDistribution,
    isLoading: studentsQuery.isLoading || resultsQuery.isLoading,
    error: studentsQuery.error || resultsQuery.error,
    refetch: () => {
      studentsQuery.refetch();
      resultsQuery.refetch();
    },
  };
}