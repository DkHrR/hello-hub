export interface GazePoint {
  x: number;
  y: number;
  timestamp: number;
}

export interface Fixation {
  x: number;
  y: number;
  duration: number;
  timestamp: number;
}

export interface Saccade {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
  isRegression: boolean;
}

export interface EyeTrackingMetrics {
  totalFixations: number;
  averageFixationDuration: number;
  regressionCount: number;
  prolongedFixations: number;
  chaosIndex: number;
  fixationIntersectionCoefficient: number;
}

export interface StallEvent {
  startTime: number;
  endTime: number;
  duration: number;
  wordBefore: string;
  wordAfter: string;
}

export interface VoiceMetrics {
  wordsPerMinute: number;
  pauseCount: number;
  averagePauseDuration: number;
  phonemicErrors: number;
  fluencyScore: number;
  prosodyScore: number;
  stallCount?: number;
  averageStallDuration?: number;
  stallEvents?: StallEvent[];
}

export interface HandwritingMetrics {
  reversalCount: number;
  letterCrowding: number;
  graphicInconsistency: number;
  lineAdherence: number;
}

export interface CognitiveLoadMetrics {
  averagePupilDilation: number;
  overloadEvents: number;
  stressIndicators: number;
}

export interface DiagnosticResult {
  eyeTracking: EyeTrackingMetrics;
  voice: VoiceMetrics;
  handwriting: HandwritingMetrics;
  cognitiveLoad: CognitiveLoadMetrics;
  dyslexiaProbabilityIndex: number;
  adhdProbabilityIndex: number;
  dysgraphiaProbabilityIndex: number;
  overallRiskLevel: 'low' | 'moderate' | 'high';
  timestamp: Date;
  sessionId: string;
}

export interface CalibrationPoint {
  x: number;
  y: number;
  completed: boolean;
}

export type TrackingBackend = 'mediapipe' | 'webgazer' | 'none';

export interface EyeTrackingDebugInfo {
  fps: number;
  landmarkCount: number;
  backend: TrackingBackend;
  lastFrameTime: number;
  confidence: number;
  gazeX?: number;
  gazeY?: number;
  isProcessing: boolean;
  initializationTime?: number;
  errorMessage?: string;
}

export interface Student {
  id: string;
  name: string;
  age: number;
  grade: string;
  diagnosticHistory: DiagnosticResult[];
  currentRiskLevel: 'low' | 'moderate' | 'high';
}
