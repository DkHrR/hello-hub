import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AssessmentResult {
  id: string;
  assessment_id: string;
  overall_risk_score: number | null;
  reading_fluency_score: number | null;
  created_at: string;
}

export function useRealTimeNotifications() {
  const { user } = useAuth();

  const showNotification = useCallback((result: AssessmentResult) => {
    const riskLevel = result.overall_risk_score
      ? result.overall_risk_score >= 0.6
        ? 'High'
        : result.overall_risk_score >= 0.3
          ? 'Moderate'
          : 'Low'
      : 'Unknown';

    const riskColor = riskLevel === 'High' ? '🔴' : riskLevel === 'Moderate' ? '🟡' : '🟢';

    toast.success(`Assessment Completed ${riskColor}`, {
      description: `Risk Level: ${riskLevel} | Fluency: ${result.reading_fluency_score ?? 'N/A'}%`,
      duration: 5000,
      action: {
        label: 'View Results',
        onClick: () => {
          window.location.href = '/dashboard?tab=reports';
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    // Subscribe to new assessment results
    const channel = supabase
      .channel('assessment-results-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'assessment_results'
        },
        (payload) => {
          const result = payload.new as AssessmentResult;
          showNotification(result);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, showNotification]);

  // Manual trigger for local notifications
  const notifyAssessmentComplete = useCallback((result: {
    overallRisk: number;
    fluencyScore: number;
  }) => {
    showNotification({
      id: 'local',
      assessment_id: 'local',
      overall_risk_score: result.overallRisk,
      reading_fluency_score: result.fluencyScore,
      created_at: new Date().toISOString()
    });
  }, [showNotification]);

  return {
    notifyAssessmentComplete
  };
}
