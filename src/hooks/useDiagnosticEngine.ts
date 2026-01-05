import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { 
  EyeTrackingMetrics, 
  VoiceMetrics, 
  HandwritingMetrics, 
  CognitiveLoadMetrics,
  DiagnosticResult,
  Fixation,
  Saccade
} from '@/types/diagnostic';

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

  // Save diagnostic result to database via assessment_results table
  const saveDiagnosticResult = useCallback(async (
    assessmentId: string,
    sessionId: string,
    result: DiagnosticResult,
    fixations: Fixation[],
    saccades: Saccade[]
  ) => {
    if (!user) throw new Error('User not authenticated');

    // Calculate scores as percentages for the assessment_results table
    const overallRiskScore = Math.max(
      result.dyslexiaProbabilityIndex,
      result.adhdProbabilityIndex,
      result.dysgraphiaProbabilityIndex
    );

    // Prepare raw data with all metrics
    const rawData = {
      sessionId,
      eyeTracking: result.eyeTracking,
      voice: result.voice,
      handwriting: result.handwriting,
      cognitiveLoad: result.cognitiveLoad,
      dyslexiaProbabilityIndex: result.dyslexiaProbabilityIndex,
      adhdProbabilityIndex: result.adhdProbabilityIndex,
      dysgraphiaProbabilityIndex: result.dysgraphiaProbabilityIndex,
      fixationCount: fixations.length,
      saccadeCount: saccades.length
    };

    // Generate recommendations
    const recommendations = generateRecommendations(result);

    // Save to assessment_results table
    const { error: resultError } = await supabase
      .from('assessment_results')
      .insert([{
        assessment_id: assessmentId,
        overall_risk_score: overallRiskScore,
        reading_fluency_score: result.voice.fluencyScore,
        phonological_awareness_score: 100 - (result.voice.phonemicErrors * 10),
        visual_processing_score: 100 - (result.eyeTracking.chaosIndex * 100),
        attention_score: 100 - (result.adhdProbabilityIndex * 100),
        recommendations: JSON.parse(JSON.stringify(recommendations)),
        raw_data: JSON.parse(JSON.stringify(rawData))
      }]);

    if (resultError) throw resultError;

    // Save eye tracking data
    const { error: eyeError } = await supabase
      .from('eye_tracking_data')
      .insert([{
        assessment_id: assessmentId,
        fixation_points: JSON.parse(JSON.stringify(fixations)),
        saccade_patterns: JSON.parse(JSON.stringify(saccades)),
        regression_count: result.eyeTracking.regressionCount,
        average_fixation_duration: result.eyeTracking.averageFixationDuration,
        reading_speed_wpm: result.voice.wordsPerMinute
      }]);

    if (eyeError) throw eyeError;

    return { success: true };
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
