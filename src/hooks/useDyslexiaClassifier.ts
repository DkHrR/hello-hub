/**
 * Dyslexia Classifier with Random Forest-style Biomarker Extraction
 * 
 * Extracts clinical biomarkers:
 * 1. Regression Rate (backward saccades, >20% = High Risk)
 * 2. Fixation Dwell (pause duration, >330ms = High Risk)
 * 3. Saccadic Amplitude (short jumps 2-4 chars = step-by-step decoding)
 */

import { useCallback, useRef } from 'react';
import type { REMoDNaVMetrics, MovementEvent, SaccadeEvent, FixationEvent } from './useREMoDNaVClassifier';

export type RiskLevel = 'low' | 'moderate' | 'high';

export interface DyslexiaBiomarkers {
  // Core biomarkers
  regressionRate: number; // percentage
  regressionRateRisk: RiskLevel;
  
  fixationDwell: number; // ms
  fixationDwellRisk: RiskLevel;
  
  saccadicAmplitude: number; // degrees
  saccadicAmplitudeRisk: RiskLevel;
  
  // Additional biomarkers
  stepByStepDecoding: boolean;
  averageSaccadeLength: number; // in character widths
  prolongedFixationRate: number; // percentage
  
  // PSO/Glissade markers (motor control issues)
  psoRate: number;
  glissadeRate: number;
  motorControlIssue: boolean;
  
  // Composite scores
  dyslexiaRiskScore: number; // 0-100
  overallRisk: RiskLevel;
  
  // Feature vector for ML
  featureVector: number[];
  
  // Confidence
  confidence: number;
}

interface ClassifierConfig {
  regressionRateHighThreshold: number;
  regressionRateModerateThreshold: number;
  fixationDwellHighThreshold: number;
  fixationDwellModerateThreshold: number;
  stepByStepAmplitudeMax: number; // 2-4 character jumps
  stepByStepAmplitudeMin: number;
  psoRateThreshold: number;
  minSamplesForConfidence: number;
  characterWidth: number; // pixels per character
}

const DEFAULT_CONFIG: ClassifierConfig = {
  regressionRateHighThreshold: 20, // >20% = high risk
  regressionRateModerateThreshold: 10, // 10-20% = moderate
  fixationDwellHighThreshold: 330, // >330ms = high risk
  fixationDwellModerateThreshold: 250, // 250-330ms = moderate
  stepByStepAmplitudeMax: 4, // characters
  stepByStepAmplitudeMin: 2, // characters
  psoRateThreshold: 30, // >30% PSO after saccades
  minSamplesForConfidence: 10,
  characterWidth: 10, // approximate pixels per character
};

// Random Forest-style decision tree ensemble weights
const DECISION_TREE_WEIGHTS = {
  regressionRate: {
    high: 0.35,
    moderate: 0.20,
    feature: 0.30,
  },
  fixationDwell: {
    high: 0.30,
    moderate: 0.15,
    feature: 0.25,
  },
  saccadicAmplitude: {
    stepByStep: 0.25,
    feature: 0.20,
  },
  motorControl: {
    pso: 0.10,
    glissade: 0.05,
    feature: 0.15,
  },
  prolongedFixation: {
    feature: 0.10,
  },
};

export function useDyslexiaClassifier(config: Partial<ClassifierConfig> = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Store historical data for trend analysis
  const historyRef = useRef<DyslexiaBiomarkers[]>([]);

  // Classify risk level based on threshold
  const classifyRisk = useCallback((
    value: number,
    highThreshold: number,
    moderateThreshold: number,
    higherIsBad: boolean = true
  ): RiskLevel => {
    if (higherIsBad) {
      if (value >= highThreshold) return 'high';
      if (value >= moderateThreshold) return 'moderate';
      return 'low';
    } else {
      if (value <= highThreshold) return 'high';
      if (value <= moderateThreshold) return 'moderate';
      return 'low';
    }
  }, []);

  // Convert amplitude (degrees) to character widths
  const amplitudeToCharacters = useCallback((amplitudeDegrees: number): number => {
    // 1 degree ≈ 35 pixels at typical viewing distance
    const pixels = amplitudeDegrees * 35;
    return pixels / cfg.characterWidth;
  }, [cfg.characterWidth]);

  // Detect step-by-step decoding pattern
  const detectStepByStepDecoding = useCallback((saccades: SaccadeEvent[]): boolean => {
    if (saccades.length < 3) return false;
    
    // Check if majority of saccades are small (2-4 character jumps)
    let smallJumpCount = 0;
    for (const saccade of saccades) {
      const charWidth = amplitudeToCharacters(saccade.amplitude);
      if (charWidth >= cfg.stepByStepAmplitudeMin && charWidth <= cfg.stepByStepAmplitudeMax) {
        smallJumpCount++;
      }
    }
    
    // If >60% of saccades are small jumps, detect step-by-step
    return (smallJumpCount / saccades.length) > 0.6;
  }, [amplitudeToCharacters, cfg.stepByStepAmplitudeMin, cfg.stepByStepAmplitudeMax]);

  // Calculate prolonged fixation rate
  const calculateProlongedFixationRate = useCallback((fixations: FixationEvent[]): number => {
    if (fixations.length === 0) return 0;
    
    const prolonged = fixations.filter(f => f.duration > cfg.fixationDwellHighThreshold);
    return (prolonged.length / fixations.length) * 100;
  }, [cfg.fixationDwellHighThreshold]);

  // Random Forest-style weighted scoring
  const calculateRiskScore = useCallback((biomarkers: Partial<DyslexiaBiomarkers>): number => {
    let score = 0;
    const weights = DECISION_TREE_WEIGHTS;
    
    // Regression rate contribution
    if (biomarkers.regressionRateRisk === 'high') {
      score += weights.regressionRate.high * 100;
    } else if (biomarkers.regressionRateRisk === 'moderate') {
      score += weights.regressionRate.moderate * 100;
    }
    // Continuous feature contribution
    if (biomarkers.regressionRate !== undefined) {
      score += weights.regressionRate.feature * Math.min(biomarkers.regressionRate / 30, 1) * 100;
    }
    
    // Fixation dwell contribution
    if (biomarkers.fixationDwellRisk === 'high') {
      score += weights.fixationDwell.high * 100;
    } else if (biomarkers.fixationDwellRisk === 'moderate') {
      score += weights.fixationDwell.moderate * 100;
    }
    if (biomarkers.fixationDwell !== undefined) {
      score += weights.fixationDwell.feature * Math.min(biomarkers.fixationDwell / 500, 1) * 100;
    }
    
    // Saccadic amplitude (step-by-step) contribution
    if (biomarkers.stepByStepDecoding) {
      score += weights.saccadicAmplitude.stepByStep * 100;
    }
    if (biomarkers.averageSaccadeLength !== undefined) {
      // Lower amplitude is concerning
      const amplitudeScore = biomarkers.averageSaccadeLength < 5 
        ? (5 - biomarkers.averageSaccadeLength) / 5 
        : 0;
      score += weights.saccadicAmplitude.feature * amplitudeScore * 100;
    }
    
    // Motor control issues
    if (biomarkers.motorControlIssue) {
      score += weights.motorControl.pso * 100;
    }
    if (biomarkers.glissadeRate !== undefined && biomarkers.glissadeRate > 20) {
      score += weights.motorControl.glissade * 100;
    }
    
    // Prolonged fixation contribution
    if (biomarkers.prolongedFixationRate !== undefined) {
      score += weights.prolongedFixation.feature * Math.min(biomarkers.prolongedFixationRate / 50, 1) * 100;
    }
    
    return Math.min(100, Math.max(0, score));
  }, []);

  // Generate feature vector for external ML systems
  const generateFeatureVector = useCallback((biomarkers: Partial<DyslexiaBiomarkers>): number[] => {
    return [
      biomarkers.regressionRate || 0,
      biomarkers.fixationDwell || 0,
      biomarkers.saccadicAmplitude || 0,
      biomarkers.averageSaccadeLength || 0,
      biomarkers.prolongedFixationRate || 0,
      biomarkers.psoRate || 0,
      biomarkers.glissadeRate || 0,
      biomarkers.stepByStepDecoding ? 1 : 0,
      biomarkers.motorControlIssue ? 1 : 0,
    ];
  }, []);

  // Main classification function
  const classify = useCallback((metrics: REMoDNaVMetrics): DyslexiaBiomarkers => {
    const saccades = metrics.events.filter(e => e.type === 'saccade') as SaccadeEvent[];
    const fixations = metrics.events.filter(e => e.type === 'fixation') as FixationEvent[];
    
    // Calculate core biomarkers
    const regressionRate = metrics.regressionRate;
    const regressionRateRisk = classifyRisk(
      regressionRate,
      cfg.regressionRateHighThreshold,
      cfg.regressionRateModerateThreshold
    );
    
    const fixationDwell = metrics.averageFixationDuration;
    const fixationDwellRisk = classifyRisk(
      fixationDwell,
      cfg.fixationDwellHighThreshold,
      cfg.fixationDwellModerateThreshold
    );
    
    const saccadicAmplitude = metrics.averageSaccadeAmplitude;
    const averageSaccadeLength = amplitudeToCharacters(saccadicAmplitude);
    const saccadicAmplitudeRisk = classifyRisk(
      averageSaccadeLength,
      cfg.stepByStepAmplitudeMax,
      cfg.stepByStepAmplitudeMax + 2,
      false // Lower is worse (step-by-step)
    );
    
    const stepByStepDecoding = detectStepByStepDecoding(saccades);
    const prolongedFixationRate = calculateProlongedFixationRate(fixations);
    
    // PSO/Glissade analysis
    const psoRate = saccades.length > 0
      ? (saccades.filter(s => s.hasPSO).length / saccades.length) * 100
      : 0;
    const glissadeRate = saccades.length > 0
      ? (saccades.filter(s => s.hasGlissade).length / saccades.length) * 100
      : 0;
    const motorControlIssue = psoRate > cfg.psoRateThreshold || glissadeRate > 20;
    
    // Build partial biomarkers for scoring
    const partialBiomarkers: Partial<DyslexiaBiomarkers> = {
      regressionRate,
      regressionRateRisk,
      fixationDwell,
      fixationDwellRisk,
      saccadicAmplitude,
      saccadicAmplitudeRisk,
      stepByStepDecoding,
      averageSaccadeLength,
      prolongedFixationRate,
      psoRate,
      glissadeRate,
      motorControlIssue,
    };
    
    // Calculate composite score
    const dyslexiaRiskScore = calculateRiskScore(partialBiomarkers);
    
    // Determine overall risk
    let overallRisk: RiskLevel = 'low';
    if (dyslexiaRiskScore >= 60) {
      overallRisk = 'high';
    } else if (dyslexiaRiskScore >= 35) {
      overallRisk = 'moderate';
    }
    
    // Calculate confidence based on sample size
    const totalEvents = metrics.events.length;
    const confidence = Math.min(1, totalEvents / (cfg.minSamplesForConfidence * 5));
    
    // Generate feature vector
    const featureVector = generateFeatureVector(partialBiomarkers);
    
    const result: DyslexiaBiomarkers = {
      regressionRate,
      regressionRateRisk,
      fixationDwell,
      fixationDwellRisk,
      saccadicAmplitude,
      saccadicAmplitudeRisk,
      stepByStepDecoding,
      averageSaccadeLength,
      prolongedFixationRate,
      psoRate,
      glissadeRate,
      motorControlIssue,
      dyslexiaRiskScore,
      overallRisk,
      featureVector,
      confidence,
    };
    
    // Store in history
    historyRef.current.push(result);
    if (historyRef.current.length > 100) {
      historyRef.current.shift();
    }
    
    return result;
  }, [
    cfg,
    classifyRisk,
    amplitudeToCharacters,
    detectStepByStepDecoding,
    calculateProlongedFixationRate,
    calculateRiskScore,
    generateFeatureVector,
  ]);

  // Get trend analysis from historical data
  const getTrendAnalysis = useCallback(() => {
    const history = historyRef.current;
    if (history.length < 2) return null;
    
    const recent = history.slice(-10);
    const older = history.slice(-20, -10);
    
    if (older.length === 0) return null;
    
    const avgRecent = recent.reduce((s, b) => s + b.dyslexiaRiskScore, 0) / recent.length;
    const avgOlder = older.reduce((s, b) => s + b.dyslexiaRiskScore, 0) / older.length;
    
    return {
      trend: avgRecent < avgOlder ? 'improving' : avgRecent > avgOlder ? 'worsening' : 'stable',
      recentAverage: avgRecent,
      historicalAverage: avgOlder,
      delta: avgOlder - avgRecent,
    };
  }, []);

  // Reset classifier
  const reset = useCallback(() => {
    historyRef.current = [];
  }, []);

  return {
    classify,
    getTrendAnalysis,
    reset,
    config: cfg,
  };
}
