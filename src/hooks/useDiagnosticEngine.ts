import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import type { 
  EyeTrackingMetrics, 
  VoiceMetrics, 
  HandwritingMetrics, 
  CognitiveLoadMetrics,
  DiagnosticResult,
  Fixation,
  Saccade
} from '@/types/diagnostic';

// Zod schemas for diagnostic data validation
const scoreSchema = z.number().min(0).max(100);

const diagnosticResultValidation = z.object({
  eyeTracking: z.object({
    chaosIndex: z.number().min(0).max(1),
    regressionCount: z.number().min(0),
    fixationIntersectionCoefficient: z.number().min(0).max(1),
    prolongedFixations: z.number().min(0),
    averageFixationDuration: z.number().min(0),
  }),
  voice: z.object({
    fluencyScore: scoreSchema,
    prosodyScore: scoreSchema.optional(),
    phonemicErrors: z.number().min(0),
    wordsPerMinute: z.number().min(0),
    stallCount: z.number().min(0).optional(),
  }),
  handwriting: z.object({
    reversalCount: z.number().min(0),
    letterCrowding: z.number().min(0).max(1),
    graphicInconsistency: z.number().min(0).max(1),
    lineAdherence: z.number().min(0).max(1),
  }),
  cognitiveLoad: z.object({
    overloadEvents: z.number().min(0),
    stressIndicators: z.number().min(0),
  }),
});

const fixationSchema = z.array(z.object({
  x: z.number(),
  y: z.number(),
  timestamp: z.number(),
  duration: z.number().optional(),
})).max(10000); // Limit array size

const saccadeSchema = z.array(z.object({
  startX: z.number(),
  startY: z.number(),
  endX: z.number(),
  endY: z.number(),
  duration: z.number().optional(),
})).max(10000); // Limit array size

interface DiagnosticWeights {
  eyeTracking: number;
  voice: number;
  handwriting: number;
  cognitiveLoad: number;
}

const DEFAULT_WEIGHTS: DiagnosticWeights = {
  eyeTracking: 0.35,
  voice: 0.30,
  handwriting: 0.20,
  cognitiveLoad: 0.15
};

export function useDiagnosticEngine() {
  const { user } = useAuth();

  // Calculate Dyslexia Probability Index using weighted scoring
  const calculateDyslexiaIndex = useCallback((
    eyeMetrics: EyeTrackingMetrics,
    voiceMetrics: VoiceMetrics,
    handwritingMetrics: HandwritingMetrics,
    weights: DiagnosticWeights = DEFAULT_WEIGHTS
  ): number => {
    // Eye tracking indicators (higher chaos/regressions = higher risk)
    const eyeScore = (
      (eyeMetrics.chaosIndex * 0.3) +
      (Math.min(eyeMetrics.regressionCount / 20, 1) * 0.25) +
      (eyeMetrics.fixationIntersectionCoefficient * 0.25) +
      (Math.min(eyeMetrics.prolongedFixations / 10, 1) * 0.2)
    );

    // Voice indicators (lower fluency = higher risk)
    const stallPenalty = voiceMetrics.stallCount ? Math.min(voiceMetrics.stallCount / 5, 1) * 0.3 : 0;
    const voiceScore = (
      (1 - voiceMetrics.fluencyScore / 100) * 0.4 +
      (1 - voiceMetrics.prosodyScore / 100) * 0.15 +
      (Math.min(voiceMetrics.phonemicErrors / 10, 1) * 0.15) +
      stallPenalty
    );

    // Handwriting indicators
    const handwritingScore = (
      (Math.min(handwritingMetrics.reversalCount / 5, 1) * 0.4) +
      (handwritingMetrics.letterCrowding * 0.25) +
      (handwritingMetrics.graphicInconsistency * 0.2) +
      ((1 - handwritingMetrics.lineAdherence) * 0.15)
    );

    // Weighted combination
    const totalScore = (
      (eyeScore * weights.eyeTracking) +
      (voiceScore * weights.voice) +
      (handwritingScore * weights.handwriting)
    ) / (weights.eyeTracking + weights.voice + weights.handwriting);

    return Math.min(1, Math.max(0, totalScore));
  }, []);

  // Calculate ADHD Probability Index
  const calculateADHDIndex = useCallback((
    eyeMetrics: EyeTrackingMetrics,
    cognitiveMetrics: CognitiveLoadMetrics
  ): number => {
    // ADHD indicators: chaotic scanpaths, stress, overload events
    const attentionScore = (
      (eyeMetrics.chaosIndex * 0.4) +
      (Math.min(cognitiveMetrics.overloadEvents / 5, 1) * 0.3) +
      (Math.min(cognitiveMetrics.stressIndicators / 10, 1) * 0.3)
    );

    return Math.min(1, Math.max(0, attentionScore));
  }, []);

  // Calculate Dysgraphia Probability Index
  const calculateDysgraphiaIndex = useCallback((
    handwritingMetrics: HandwritingMetrics
  ): number => {
    return Math.min(1, Math.max(0, (
      (Math.min(handwritingMetrics.reversalCount / 5, 1) * 0.35) +
      (handwritingMetrics.letterCrowding * 0.25) +
      (handwritingMetrics.graphicInconsistency * 0.25) +
      ((1 - handwritingMetrics.lineAdherence) * 0.15)
    )));
  }, []);

  // Determine overall risk level
  const determineRiskLevel = useCallback((
    dyslexiaIndex: number,
    adhdIndex: number,
    dysgraphiaIndex: number
  ): 'low' | 'moderate' | 'high' => {
    const maxIndex = Math.max(dyslexiaIndex, adhdIndex, dysgraphiaIndex);
    
    if (maxIndex >= 0.6) return 'high';
    if (maxIndex >= 0.3) return 'moderate';
    return 'low';
  }, []);

  // Create full diagnostic result
  const createDiagnosticResult = useCallback((
    eyeMetrics: EyeTrackingMetrics,
    voiceMetrics: VoiceMetrics,
    handwritingMetrics: HandwritingMetrics,
    cognitiveMetrics: CognitiveLoadMetrics
  ): DiagnosticResult => {
    const dyslexiaIndex = calculateDyslexiaIndex(eyeMetrics, voiceMetrics, handwritingMetrics);
    const adhdIndex = calculateADHDIndex(eyeMetrics, cognitiveMetrics);
    const dysgraphiaIndex = calculateDysgraphiaIndex(handwritingMetrics);
    const overallRisk = determineRiskLevel(dyslexiaIndex, adhdIndex, dysgraphiaIndex);

    return {
      eyeTracking: eyeMetrics,
      voice: voiceMetrics,
      handwriting: handwritingMetrics,
      cognitiveLoad: cognitiveMetrics,
      dyslexiaProbabilityIndex: dyslexiaIndex,
      adhdProbabilityIndex: adhdIndex,
      dysgraphiaProbabilityIndex: dysgraphiaIndex,
      overallRiskLevel: overallRisk,
      timestamp: new Date(),
      sessionId: `NRX-${Date.now().toString(36).toUpperCase()}`
    };
  }, [calculateDyslexiaIndex, calculateADHDIndex, calculateDysgraphiaIndex, determineRiskLevel]);

  // Save diagnostic result to database using assessments and assessment_results tables
  const saveDiagnosticResult = useCallback(async (
    studentId: string | null,  // Can be null for self-assessments
    sessionId: string,
    result: DiagnosticResult,
    fixations: Fixation[],
    saccades: Saccade[]
  ) => {
    if (!user) throw new Error('User not authenticated');

    // Validate student ID if provided
    if (studentId) {
      z.string().uuid('Invalid student ID').parse(studentId);
    }
    
    // Validate session ID length
    z.string().max(50, 'Session ID too long').parse(sessionId);
    
    // Validate diagnostic result structure (partial validation for essential fields)
    const validatedResult = diagnosticResultValidation.safeParse({
      eyeTracking: result.eyeTracking,
      voice: result.voice,
      handwriting: result.handwriting,
      cognitiveLoad: result.cognitiveLoad,
    });
    
    if (!validatedResult.success) {
      logger.warn('Diagnostic result validation warning', { errors: validatedResult.error.errors });
      // Continue with original data but log the warning
    }
    
    // Validate and limit fixations/saccades arrays
    const validatedFixations = fixationSchema.safeParse(fixations);
    const validatedSaccades = saccadeSchema.safeParse(saccades);
    
    const safeFixations = validatedFixations.success ? validatedFixations.data : fixations.slice(0, 10000);
    const safeSaccades = validatedSaccades.success ? validatedSaccades.data : saccades.slice(0, 10000);

    // First create an assessment
    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .insert({
        assessor_id: user.id,
        user_id: studentId ? null : user.id,
        student_id: studentId,
        assessment_type: 'comprehensive',
        status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (assessmentError) throw assessmentError;

    // Then create the assessment result
    const { data: resultData, error: resultError } = await supabase
      .from('assessment_results')
      .insert([{
        assessment_id: assessment.id,
        overall_risk_score: result.dyslexiaProbabilityIndex,
        reading_fluency_score: result.voice.fluencyScore / 100,
        phonological_awareness_score: 1 - (result.voice.phonemicErrors / 10),
        visual_processing_score: 1 - result.eyeTracking.chaosIndex,
        attention_score: 1 - result.adhdProbabilityIndex,
        raw_data: JSON.parse(JSON.stringify({
          eyeTracking: result.eyeTracking,
          voice: result.voice,
          handwriting: result.handwriting,
          cognitiveLoad: result.cognitiveLoad,
          dyslexiaProbabilityIndex: result.dyslexiaProbabilityIndex,
          adhdProbabilityIndex: result.adhdProbabilityIndex,
          dysgraphiaProbabilityIndex: result.dysgraphiaProbabilityIndex,
          overallRiskLevel: result.overallRiskLevel,
          sessionId: sessionId,
        })),
        dyslexia_biomarkers: {
          chaosIndex: result.eyeTracking.chaosIndex,
          regressionCount: result.eyeTracking.regressionCount,
          fixationIntersectionCoefficient: result.eyeTracking.fixationIntersectionCoefficient,
        },
      }])
      .select()
      .single();

    if (resultError) throw resultError;

    // Store eye tracking data
    const { error: eyeError } = await supabase
      .from('eye_tracking_data')
      .insert({
        assessment_id: assessment.id,
        average_fixation_duration: result.eyeTracking.averageFixationDuration,
        regression_count: result.eyeTracking.regressionCount,
        reading_speed_wpm: result.voice.wordsPerMinute,
        fixation_points: safeFixations,
        saccade_patterns: safeSaccades,
        biomarkers: {
          chaosIndex: result.eyeTracking.chaosIndex,
          prolongedFixations: result.eyeTracking.prolongedFixations,
          fixationIntersectionCoefficient: result.eyeTracking.fixationIntersectionCoefficient,
        },
      });

    if (eyeError) {
      logger.warn('Failed to save eye tracking data', { error: eyeError });
    }

    return { success: true, assessmentId: resultData.id };
  }, [user]);

  // Generate recommendations based on results
  const generateRecommendations = (result: DiagnosticResult): string[] => {
    const recommendations: string[] = [];

    if (result.dyslexiaProbabilityIndex >= 0.5) {
      recommendations.push('Consider structured literacy intervention');
      recommendations.push('Use multi-sensory reading instruction');
      recommendations.push('Implement phonics-based reading program');
    }

    if (result.adhdProbabilityIndex >= 0.5) {
      recommendations.push('Break reading tasks into shorter sessions');
      recommendations.push('Use visual timers and frequent breaks');
      recommendations.push('Minimize environmental distractions');
    }

    if (result.dysgraphiaProbabilityIndex >= 0.5) {
      recommendations.push('Practice letter formation exercises');
      recommendations.push('Consider occupational therapy assessment');
      recommendations.push('Allow use of assistive technology for writing');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue current reading program');
      recommendations.push('Monitor progress with regular assessments');
    }

    return recommendations;
  };

  return {
    calculateDyslexiaIndex,
    calculateADHDIndex,
    calculateDysgraphiaIndex,
    determineRiskLevel,
    createDiagnosticResult,
    saveDiagnosticResult,
    generateRecommendations,
  };
}