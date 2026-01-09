/**
 * AI Insights Hook
 * Calls the AI insights edge function to generate personalized recommendations
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DiagnosticResult } from '@/types/diagnostic';
import type { DyslexiaBiomarkers } from '@/hooks/useDyslexiaClassifier';
import type { REMoDNaVMetrics } from '@/hooks/useREMoDNaVClassifier';

export interface AIInsights {
  summary: string;
  keyFindings: string[];
  interventionStrategies: {
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    frequency: string;
    duration: string;
  }[];
  readingRecommendations: {
    level: string;
    materials: string[];
    focusAreas: string[];
  };
  weeklyPlan: {
    day: string;
    activity: string;
    duration: string;
  }[];
  progressForecast: string;
  clinicalNotes: string;
  confidence: number;
}

interface UseAIInsightsReturn {
  insights: AIInsights | null;
  isLoading: boolean;
  error: string | null;
  generateInsights: (
    diagnosticResult: DiagnosticResult,
    biomarkers?: DyslexiaBiomarkers,
    remoDNavMetrics?: REMoDNaVMetrics,
    studentInfo?: { name: string; grade: string; age?: number }
  ) => Promise<AIInsights | null>;
  regenerate: () => Promise<void>;
  clearInsights: () => void;
}

export function useAIInsights(): UseAIInsightsReturn {
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastParams, setLastParams] = useState<Parameters<UseAIInsightsReturn['generateInsights']> | null>(null);

  const generateInsights = useCallback(async (
    diagnosticResult: DiagnosticResult,
    biomarkers?: DyslexiaBiomarkers,
    remoDNavMetrics?: REMoDNaVMetrics,
    studentInfo?: { name: string; grade: string; age?: number }
  ): Promise<AIInsights | null> => {
    setIsLoading(true);
    setError(null);
    setLastParams([diagnosticResult, biomarkers, remoDNavMetrics, studentInfo]);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-insights', {
        body: {
          diagnosticResult,
          biomarkers,
          remoDNavMetrics,
          studentInfo,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to generate AI insights');
      }

      if (!data || !data.insights) {
        throw new Error('Invalid response from AI insights service');
      }

      setInsights(data.insights);
      return data.insights;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(message);
      console.error('AI Insights Error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const regenerate = useCallback(async () => {
    if (lastParams) {
      await generateInsights(...lastParams);
    }
  }, [lastParams, generateInsights]);

  const clearInsights = useCallback(() => {
    setInsights(null);
    setError(null);
  }, []);

  return {
    insights,
    isLoading,
    error,
    generateInsights,
    regenerate,
    clearInsights,
  };
}
