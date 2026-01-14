import { useState, useCallback, useRef, useEffect } from 'react';
import { useUnifiedEyeTracking } from './useUnifiedEyeTracking';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useCognitiveLoad } from './useCognitiveLoad';
import { useHandwritingAnalysis } from './useHandwritingAnalysis';
import { useDiagnosticEngine } from './useDiagnosticEngine';
import { useAuth } from '@/contexts/AuthContext';
import { getSpeechLocale, type SupportedLanguage } from '@/data/phoneticPatterns';
import logger from '@/lib/logger';
import type { 
  DiagnosticResult, 
  EyeTrackingMetrics, 
  VoiceMetrics, 
  HandwritingMetrics,
  CognitiveLoadMetrics,
  Fixation,
  Saccade,
  EyeTrackingDebugInfo,
  TrackingBackend
} from '@/types/diagnostic';

export type AssessmentStep = 
  | 'intro' 
  | 'calibration' 
  | 'reading' 
  | 'voice' 
  | 'handwriting'
  | 'processing'
  | 'results';

export interface AssessmentState {
  step: AssessmentStep;
  eyeMetrics: EyeTrackingMetrics | null;
  voiceMetrics: VoiceMetrics | null;
  handwritingMetrics: HandwritingMetrics | null;
  cognitiveMetrics: CognitiveLoadMetrics | null;
  result: DiagnosticResult | null;
  fixations: Fixation[];
  saccades: Saccade[];
  stallWord: string | null;
  stallPosition: { x: number; y: number } | null;
  stallDuration: number;
}

interface UseAssessmentControllerOptions {
  studentId?: string;
  studentName?: string;
  studentAge?: number;
  studentGrade?: string;
  language?: SupportedLanguage;
  onComplete?: (result: DiagnosticResult) => void;
}

export function useAssessmentController(options: UseAssessmentControllerOptions = {}) {
  const { studentId, studentGrade = 'default', language = 'en', onComplete } = options;
  
  // Auth hook for self-assessments
  const { user } = useAuth();
  
  // All the hooks - using unified MediaPipe eye tracking
  const eyeTracking = useUnifiedEyeTracking();
  const speechRecognition = useSpeechRecognition({ language, grade: studentGrade });
  const cognitiveLoad = useCognitiveLoad();
  const handwritingAnalysis = useHandwritingAnalysis({ language });
  const diagnosticEngine = useDiagnosticEngine();
  
  // Current language state (can be updated dynamically)
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(language);
  const [currentGrade, setCurrentGrade] = useState(studentGrade);
  
  // Assessment state
  const [step, setStep] = useState<AssessmentStep>('intro');
  const [eyeMetrics, setEyeMetrics] = useState<EyeTrackingMetrics | null>(null);
  const [voiceMetrics, setVoiceMetrics] = useState<VoiceMetrics | null>(null);
  const [handwritingMetrics, setHandwritingMetrics] = useState<HandwritingMetrics | null>(null);
  const [cognitiveMetrics, setCognitiveMetrics] = useState<CognitiveLoadMetrics | null>(null);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Gaze tutor state
  const [stallWord, setStallWord] = useState<string | null>(null);
  const [stallPosition, setStallPosition] = useState<{ x: number; y: number } | null>(null);
  const [stallDuration, setStallDuration] = useState(0);
  const wordPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  
  // Update language dynamically
  const updateLanguage = useCallback((lang: SupportedLanguage, grade?: string) => {
    setCurrentLanguage(lang);
    if (grade) setCurrentGrade(grade);
    
    // Update child hooks
    speechRecognition.setLanguage(lang, grade);
    handwritingAnalysis.setLanguage(lang);
  }, [speechRecognition, handwritingAnalysis]);
  
  // Start assessment - go to calibration
  const startAssessment = useCallback(() => {
    setStep('calibration');
  }, []);
  
  // Calibration complete - start reading test with tracking
  const handleCalibrationComplete = useCallback(async () => {
    eyeTracking.setIsCalibrated(true);
    await eyeTracking.initialize();
    await eyeTracking.startTracking(); // Actually start the tracking loop
    cognitiveLoad.startMonitoring();
    setStep('reading');
  }, [eyeTracking, cognitiveLoad]);
  
  // Skip calibration
  const handleSkipCalibration = useCallback(async () => {
    await eyeTracking.initialize();
    cognitiveLoad.startMonitoring();
    setStep('reading');
  }, [eyeTracking, cognitiveLoad]);
  
  // Move to voice test
  const startVoiceTest = useCallback(() => {
    // Capture eye tracking metrics before stopping
    const metrics = eyeTracking.getMetrics();
    setEyeMetrics(metrics);
    
    eyeTracking.stop();
    // Start speech recognition with correct locale
    const locale = getSpeechLocale(currentLanguage);
    speechRecognition.start(locale);
    setStep('voice');
  }, [eyeTracking, speechRecognition, currentLanguage]);
  
  // Move to handwriting test (optional)
  const startHandwritingTest = useCallback(() => {
    speechRecognition.stop();
    const metrics = speechRecognition.getMetrics();
    setVoiceMetrics(metrics);
    
    setStep('handwriting');
  }, [speechRecognition]);
  
  // Skip handwriting test
  const skipHandwritingTest = useCallback(() => {
    // Use default handwriting metrics
    setHandwritingMetrics({
      reversalCount: 0,
      letterCrowding: 0,
      graphicInconsistency: 0,
      lineAdherence: 1
    });
  }, []);
  
  // Handle handwriting analysis complete
  const handleHandwritingComplete = useCallback((metrics: HandwritingMetrics) => {
    setHandwritingMetrics(metrics);
  }, []);
  
  // Finish assessment and calculate results
  const finishAssessment = useCallback(async () => {
    setStep('processing');
    setIsProcessing(true);
    
    // Get final metrics
    const finalEyeMetrics = eyeMetrics || eyeTracking.getMetrics();
    const finalVoiceMetrics = voiceMetrics || speechRecognition.getMetrics();
    const finalCognitiveMetrics = cognitiveLoad.getMetrics();
    const finalHandwritingMetrics = handwritingMetrics || {
      reversalCount: 0,
      letterCrowding: 0,
      graphicInconsistency: 0,
      lineAdherence: 1
    };
    
    // Stop all monitoring
    speechRecognition.stop();
    eyeTracking.stop();
    cognitiveLoad.stopMonitoring();
    
    // Store metrics
    setEyeMetrics(finalEyeMetrics);
    setVoiceMetrics(finalVoiceMetrics);
    setCognitiveMetrics(finalCognitiveMetrics);
    
    // Calculate diagnostic result using the engine
    const diagnosticResult = diagnosticEngine.createDiagnosticResult(
      finalEyeMetrics,
      finalVoiceMetrics,
      finalHandwritingMetrics,
      finalCognitiveMetrics
    );
    
    setResult(diagnosticResult);
    
    // Save to database for authenticated users
    // Works for both clinician assessments (with studentId) and self-assessments (without studentId)
    if (user) {
      try {
        await diagnosticEngine.saveDiagnosticResult(
          studentId || null,  // null for self-assessments
          diagnosticResult.sessionId,
          diagnosticResult,
          eyeTracking.fixations,
          eyeTracking.saccades
        );
        logger.info('Diagnostic result saved successfully');
      } catch (error) {
        logger.error('Failed to save diagnostic result', error);
      }
    }
    
    setIsProcessing(false);
    setStep('results');
    
    onComplete?.(diagnosticResult);
  }, [
    eyeMetrics,
    voiceMetrics,
    handwritingMetrics,
    eyeTracking,
    speechRecognition,
    cognitiveLoad,
    diagnosticEngine,
    studentId,
    user,
    onComplete
  ]);
  
  // Reset assessment
  const resetAssessment = useCallback(() => {
    eyeTracking.reset();
    speechRecognition.reset();
    cognitiveLoad.reset();
    handwritingAnalysis.reset();
    
    setStep('intro');
    setEyeMetrics(null);
    setVoiceMetrics(null);
    setHandwritingMetrics(null);
    setCognitiveMetrics(null);
    setResult(null);
    setStallWord(null);
    setStallPosition(null);
    setStallDuration(0);
  }, [eyeTracking, speechRecognition, cognitiveLoad, handwritingAnalysis]);
  
  // Register word position for gaze tutor
  const registerWordPosition = useCallback((word: string, position: { x: number; y: number }) => {
    wordPositionsRef.current.set(word.toLowerCase(), position);
  }, []);
  
  // Detect which word user is looking at based on gaze position
  useEffect(() => {
    if (!eyeTracking.currentGaze || step !== 'reading') return;
    
    const gaze = eyeTracking.currentGaze;
    let closestWord: string | null = null;
    let closestDistance = Infinity;
    let closestPosition: { x: number; y: number } | null = null;
    
    wordPositionsRef.current.forEach((pos, word) => {
      const distance = Math.sqrt(
        Math.pow(gaze.x - pos.x, 2) + Math.pow(gaze.y - pos.y, 2)
      );
      if (distance < closestDistance && distance < 100) {
        closestDistance = distance;
        closestWord = word;
        closestPosition = pos;
      }
    });
    
    // Check for prolonged fixation on a word
    const metrics = eyeTracking.getMetrics();
    if (closestWord && metrics.averageFixationDuration > 400) {
      setStallWord(closestWord);
      setStallPosition(closestPosition);
      // Duration would come from actual fixation tracking
      setStallDuration(metrics.averageFixationDuration);
    } else {
      setStallWord(null);
      setStallPosition(null);
      setStallDuration(0);
    }
  }, [eyeTracking.currentGaze, eyeTracking, step]);
  
  return {
    // State
    step,
    eyeMetrics,
    voiceMetrics,
    handwritingMetrics,
    cognitiveMetrics,
    result,
    isProcessing,
    
    // Language state
    currentLanguage,
    currentGrade,
    updateLanguage,
    
    // Gaze tutor state
    stallWord,
    stallPosition,
    stallDuration,
    
    // Eye tracking passthrough
    eyeTracking: {
      isInitialized: eyeTracking.isInitialized,
      isTracking: eyeTracking.isTracking,
      isCalibrated: eyeTracking.isCalibrated,
      currentGaze: eyeTracking.currentGaze,
      gazeData: eyeTracking.gazeData,
      fixations: eyeTracking.fixations,
      saccades: eyeTracking.saccades,
      getMetrics: eyeTracking.getMetrics,
      activeBackend: eyeTracking.activeBackend,
      debugInfo: eyeTracking.debugInfo
    },
    
    // Speech recognition passthrough
    speechRecognition: {
      isListening: speechRecognition.isListening,
      transcript: speechRecognition.transcript,
      interimTranscript: speechRecognition.interimTranscript,
      isStalling: speechRecognition.isStalling,
      currentStallDuration: speechRecognition.currentStallDuration,
      stallEvents: speechRecognition.stallEvents,
      currentLanguage: speechRecognition.currentLanguage,
      start: speechRecognition.start,
      stop: speechRecognition.stop,
      reset: speechRecognition.reset,
      getMetrics: speechRecognition.getMetrics,
      setLanguage: speechRecognition.setLanguage
    },
    
    // Cognitive load passthrough
    cognitiveLoad: {
      isMonitoring: cognitiveLoad.isMonitoring,
      currentLoad: cognitiveLoad.currentLoad,
      overloadEvents: cognitiveLoad.overloadEvents
    },
    
    // Handwriting passthrough
    handwritingAnalysis: {
      isAnalyzing: handwritingAnalysis.isAnalyzing,
      progress: handwritingAnalysis.progress,
      recognizedText: handwritingAnalysis.recognizedText,
      currentLanguage: handwritingAnalysis.currentLanguage,
      analyzeImage: handwritingAnalysis.analyzeImage,
      setLanguage: handwritingAnalysis.setLanguage
    },
    
    // Actions
    startAssessment,
    handleCalibrationComplete,
    handleSkipCalibration,
    startVoiceTest,
    startHandwritingTest,
    skipHandwritingTest,
    handleHandwritingComplete,
    finishAssessment,
    resetAssessment,
    registerWordPosition
  };
}
