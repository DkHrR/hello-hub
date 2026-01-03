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

  // Save diagnostic result to database
  const saveDiagnosticResult = useCallback(async (
    studentId: string,
    result: DiagnosticResult,
    fixations: Fixation[],
    saccades: Saccade[]
  ) => {
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('diagnostic_results')
      .insert([{
        student_id: studentId,
        clinician_id: user.id,
        session_id: result.sessionId,
        
        // Eye tracking
        eye_total_fixations: result.eyeTracking.totalFixations,
        eye_avg_fixation_duration: result.eyeTracking.averageFixationDuration,
        eye_regression_count: result.eyeTracking.regressionCount,
        eye_prolonged_fixations: result.eyeTracking.prolongedFixations,
        eye_chaos_index: result.eyeTracking.chaosIndex,
        eye_fixation_intersection_coefficient: result.eyeTracking.fixationIntersectionCoefficient,
        
        // Voice
        voice_words_per_minute: result.voice.wordsPerMinute,
        voice_pause_count: result.voice.pauseCount,
        voice_avg_pause_duration: result.voice.averagePauseDuration,
        voice_phonemic_errors: result.voice.phonemicErrors,
        voice_fluency_score: result.voice.fluencyScore,
        voice_prosody_score: result.voice.prosodyScore,
        voice_stall_count: result.voice.stallCount || 0,
        voice_avg_stall_duration: result.voice.averageStallDuration || 0,
        voice_stall_events: JSON.parse(JSON.stringify(result.voice.stallEvents || [])),
        
        // Handwriting
        handwriting_reversal_count: result.handwriting.reversalCount,
        handwriting_letter_crowding: result.handwriting.letterCrowding,
        handwriting_graphic_inconsistency: result.handwriting.graphicInconsistency,
        handwriting_line_adherence: result.handwriting.lineAdherence,
        
        // Cognitive load
        cognitive_avg_pupil_dilation: result.cognitiveLoad.averagePupilDilation,
        cognitive_overload_events: result.cognitiveLoad.overloadEvents,
        cognitive_stress_indicators: result.cognitiveLoad.stressIndicators,
        
        // Probability indices
        dyslexia_probability_index: result.dyslexiaProbabilityIndex,
        adhd_probability_index: result.adhdProbabilityIndex,
        dysgraphia_probability_index: result.dysgraphiaProbabilityIndex,
        overall_risk_level: result.overallRiskLevel,
        
        // Raw data for visualizations
        fixation_data: JSON.parse(JSON.stringify(fixations)),
        saccade_data: JSON.parse(JSON.stringify(saccades))
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }, [user]);

  // Update student risk level based on latest assessment
  const updateStudentRiskLevel = useCallback(async (
    studentId: string,
    riskLevel: 'low' | 'moderate' | 'high'
  ) => {
    if (!user) throw new Error('User not authenticated');

    // Map 'moderate' to 'medium' for database
    const dbRiskLevel = riskLevel === 'moderate' ? 'medium' : riskLevel as 'low' | 'high';

    const { error } = await supabase
      .from('students')
      .update({ risk_level: dbRiskLevel })
      .eq('id', studentId);

    if (error) throw error;
  }, [user]);

  return {
    calculateDyslexiaIndex,
    calculateADHDIndex,
    calculateDysgraphiaIndex,
    determineRiskLevel,
    createDiagnosticResult,
    saveDiagnosticResult,
    updateStudentRiskLevel
  };
}