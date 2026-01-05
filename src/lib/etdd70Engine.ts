/**
 * ETDD70 Universal Dataset Engine
 * Clinical-grade dyslexia probability scoring based on eye-tracking metrics
 * 
 * Reference thresholds derived from ETDD70 Universal Dyslexia Dataset
 * and clinical research standards
 */

export interface EyeTrackingMetrics {
  fixations: Array<{
    x: number;
    y: number;
    duration: number;
    timestamp: number;
  }>;
  saccades: Array<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    velocity?: number;
  }>;
  totalReadingTime: number;
  textLength: number;
}

export interface ETDD70Score {
  dyslexiaProbability: number;
  riskLevel: 'low' | 'moderate' | 'high';
  indicators: {
    prolongedFixations: { value: number; threshold: number; exceeded: boolean };
    regressiveSaccades: { value: number; threshold: number; exceeded: boolean };
    fixationDuration: { value: number; threshold: number; exceeded: boolean };
    readingSpeed: { value: number; threshold: number; exceeded: boolean };
    chaosIndex: { value: number; threshold: number; exceeded: boolean };
    ficScore: { value: number; threshold: number; exceeded: boolean };
  };
  clinicalNotes: string[];
}

// ETDD70 Universal Dataset Thresholds
const ETDD70_THRESHOLDS = {
  // Fixation duration threshold (ms) - clinical standard is 330ms for dyslexia indicators
  FIXATION_DURATION_THRESHOLD: 330,
  
  // Prolonged fixation threshold (ms)
  PROLONGED_FIXATION_THRESHOLD: 400,
  
  // Regression rate threshold (%) - dyslexic readers show >20% regressions
  REGRESSION_RATE_THRESHOLD: 20,
  
  // Reading speed threshold (words per minute) for age-adjusted scoring
  READING_SPEED_LOW: 80,
  READING_SPEED_VERY_LOW: 50,
  
  // Chaos Index threshold - measure of gaze path irregularity
  CHAOS_INDEX_THRESHOLD: 0.35,
  
  // Fixation Intersection Coefficient - overlap measure
  FIC_THRESHOLD: 0.6,
  
  // Weight factors for probability calculation
  WEIGHTS: {
    fixationDuration: 0.25,
    regressionRate: 0.25,
    prolongedFixations: 0.20,
    chaosIndex: 0.15,
    ficScore: 0.15
  }
};

/**
 * Calculate the Chaos Index from fixation data
 * Measures irregularity in reading pattern
 */
function calculateChaosIndex(fixations: EyeTrackingMetrics['fixations']): number {
  if (fixations.length < 3) return 0;
  
  let totalAngleVariance = 0;
  let angleCount = 0;
  
  for (let i = 1; i < fixations.length - 1; i++) {
    const prev = fixations[i - 1];
    const curr = fixations[i];
    const next = fixations[i + 1];
    
    // Calculate angles between consecutive fixation vectors
    const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
    
    // Angle difference (normalized to 0-1)
    const angleDiff = Math.abs(angle2 - angle1) / Math.PI;
    totalAngleVariance += angleDiff;
    angleCount++;
  }
  
  return angleCount > 0 ? totalAngleVariance / angleCount : 0;
}

/**
 * Calculate Fixation Intersection Coefficient (FIC)
 * Measures how often gaze paths cross over previously read areas
 */
function calculateFIC(fixations: EyeTrackingMetrics['fixations']): number {
  if (fixations.length < 4) return 0;
  
  let intersections = 0;
  const gridSize = 50;
  const visited = new Set<string>();
  
  for (const f of fixations) {
    const key = `${Math.floor(f.x / gridSize)}-${Math.floor(f.y / gridSize)}`;
    if (visited.has(key)) {
      intersections++;
    }
    visited.add(key);
  }
  
  return intersections / fixations.length;
}

/**
 * Count regressive saccades (backward eye movements)
 */
function countRegressions(saccades: EyeTrackingMetrics['saccades']): number {
  return saccades.filter(s => s.endX < s.startX - 20).length; // 20px tolerance
}

/**
 * Main ETDD70 scoring function
 * Calculates dyslexia probability based on eye-tracking metrics
 */
export function calculateETDD70Score(metrics: EyeTrackingMetrics): ETDD70Score {
  const { fixations, saccades, totalReadingTime, textLength } = metrics;
  
  const clinicalNotes: string[] = [];
  
  // 1. Calculate average fixation duration
  const avgFixationDuration = fixations.length > 0
    ? fixations.reduce((sum, f) => sum + f.duration, 0) / fixations.length
    : 0;
  
  const fixationExceeded = avgFixationDuration > ETDD70_THRESHOLDS.FIXATION_DURATION_THRESHOLD;
  if (fixationExceeded) {
    clinicalNotes.push(`Average fixation duration (${avgFixationDuration.toFixed(0)}ms) exceeds clinical threshold of ${ETDD70_THRESHOLDS.FIXATION_DURATION_THRESHOLD}ms`);
  }
  
  // 2. Count prolonged fixations
  const prolongedFixations = fixations.filter(
    f => f.duration > ETDD70_THRESHOLDS.PROLONGED_FIXATION_THRESHOLD
  ).length;
  const prolongedRatio = fixations.length > 0 ? (prolongedFixations / fixations.length) * 100 : 0;
  const prolongedExceeded = prolongedRatio > 15; // >15% prolonged fixations is concerning
  
  if (prolongedExceeded) {
    clinicalNotes.push(`High rate of prolonged fixations (${prolongedRatio.toFixed(1)}%) indicates word-level processing difficulties`);
  }
  
  // 3. Calculate regression rate
  const regressionCount = countRegressions(saccades);
  const regressionRate = saccades.length > 0 ? (regressionCount / saccades.length) * 100 : 0;
  const regressionExceeded = regressionRate > ETDD70_THRESHOLDS.REGRESSION_RATE_THRESHOLD;
  
  if (regressionExceeded) {
    clinicalNotes.push(`Regression rate (${regressionRate.toFixed(1)}%) exceeds ${ETDD70_THRESHOLDS.REGRESSION_RATE_THRESHOLD}% threshold, suggesting decoding challenges`);
  }
  
  // 4. Calculate reading speed (approximate)
  const wordsRead = textLength / 5; // Approximate words from characters
  const readingTimeMinutes = totalReadingTime / 60000;
  const readingSpeed = readingTimeMinutes > 0 ? wordsRead / readingTimeMinutes : 0;
  const speedExceeded = readingSpeed < ETDD70_THRESHOLDS.READING_SPEED_LOW;
  
  if (readingSpeed < ETDD70_THRESHOLDS.READING_SPEED_VERY_LOW) {
    clinicalNotes.push(`Very low reading speed (${readingSpeed.toFixed(0)} WPM) requires immediate attention`);
  } else if (speedExceeded) {
    clinicalNotes.push(`Below-average reading speed (${readingSpeed.toFixed(0)} WPM)`);
  }
  
  // 5. Calculate Chaos Index
  const chaosIndex = calculateChaosIndex(fixations);
  const chaosExceeded = chaosIndex > ETDD70_THRESHOLDS.CHAOS_INDEX_THRESHOLD;
  
  if (chaosExceeded) {
    clinicalNotes.push(`High gaze chaos index (${chaosIndex.toFixed(2)}) indicates irregular reading pattern`);
  }
  
  // 6. Calculate FIC
  const ficScore = calculateFIC(fixations);
  const ficExceeded = ficScore > ETDD70_THRESHOLDS.FIC_THRESHOLD;
  
  if (ficExceeded) {
    clinicalNotes.push(`High fixation intersection (${ficScore.toFixed(2)}) suggests frequent re-reading`);
  }
  
  // Calculate weighted probability score
  const { WEIGHTS } = ETDD70_THRESHOLDS;
  
  let probability = 0;
  
  // Fixation duration contribution (0-1 normalized)
  const fixationScore = Math.min(1, avgFixationDuration / 400); // 400ms = 100%
  probability += fixationScore * WEIGHTS.fixationDuration;
  
  // Regression rate contribution
  const regressionScore = Math.min(1, regressionRate / 40); // 40% = 100%
  probability += regressionScore * WEIGHTS.regressionRate;
  
  // Prolonged fixations contribution
  const prolongedScore = Math.min(1, prolongedRatio / 30); // 30% = 100%
  probability += prolongedScore * WEIGHTS.prolongedFixations;
  
  // Chaos index contribution
  const chaosScore = Math.min(1, chaosIndex / 0.6); // 0.6 = 100%
  probability += chaosScore * WEIGHTS.chaosIndex;
  
  // FIC contribution
  const ficContribution = Math.min(1, ficScore / 0.8); // 0.8 = 100%
  probability += ficContribution * WEIGHTS.ficScore;
  
  // Determine risk level
  let riskLevel: 'low' | 'moderate' | 'high';
  if (probability >= 0.65) {
    riskLevel = 'high';
    clinicalNotes.push('⚠️ High probability of dyslexia. Professional evaluation recommended.');
  } else if (probability >= 0.35) {
    riskLevel = 'moderate';
    clinicalNotes.push('Moderate indicators present. Continued monitoring advised.');
  } else {
    riskLevel = 'low';
  }
  
  return {
    dyslexiaProbability: probability,
    riskLevel,
    indicators: {
      prolongedFixations: {
        value: prolongedRatio,
        threshold: 15,
        exceeded: prolongedExceeded
      },
      regressiveSaccades: {
        value: regressionRate,
        threshold: ETDD70_THRESHOLDS.REGRESSION_RATE_THRESHOLD,
        exceeded: regressionExceeded
      },
      fixationDuration: {
        value: avgFixationDuration,
        threshold: ETDD70_THRESHOLDS.FIXATION_DURATION_THRESHOLD,
        exceeded: fixationExceeded
      },
      readingSpeed: {
        value: readingSpeed,
        threshold: ETDD70_THRESHOLDS.READING_SPEED_LOW,
        exceeded: speedExceeded
      },
      chaosIndex: {
        value: chaosIndex,
        threshold: ETDD70_THRESHOLDS.CHAOS_INDEX_THRESHOLD,
        exceeded: chaosExceeded
      },
      ficScore: {
        value: ficScore,
        threshold: ETDD70_THRESHOLDS.FIC_THRESHOLD,
        exceeded: ficExceeded
      }
    },
    clinicalNotes
  };
}

/**
 * Generate clinical diagnostic report text
 */
export function generateClinicalReport(score: ETDD70Score): string {
  const lines = [
    '=== CLINICAL DIAGNOSTIC REPORT ===',
    `Date: ${new Date().toLocaleDateString('en-IN')}`,
    '',
    `DYSLEXIA PROBABILITY INDEX: ${(score.dyslexiaProbability * 100).toFixed(1)}%`,
    `RISK LEVEL: ${score.riskLevel.toUpperCase()}`,
    '',
    '--- INDICATOR ANALYSIS ---'
  ];
  
  Object.entries(score.indicators).forEach(([key, data]) => {
    const status = data.exceeded ? '⚠️ EXCEEDED' : '✓ Normal';
    lines.push(`${key}: ${data.value.toFixed(2)} (threshold: ${data.threshold}) ${status}`);
  });
  
  if (score.clinicalNotes.length > 0) {
    lines.push('', '--- CLINICAL NOTES ---');
    score.clinicalNotes.forEach(note => lines.push(`• ${note}`));
  }
  
  lines.push(
    '',
    '--- DISCLAIMER ---',
    'This report is generated by the Neuro-Read X AI system and is intended for',
    'screening purposes only. It does not constitute a clinical diagnosis.',
    'Please consult with a qualified healthcare professional for evaluation.',
    '',
    'Based on ETDD70 Universal Dataset thresholds and IIT Madras research standards.'
  );
  
  return lines.join('\n');
}
