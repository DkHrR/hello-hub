import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BalloonCalibration } from '@/components/assessment/BalloonCalibration';
import { BiometricPreCheck } from '@/components/assessment/BiometricPreCheck';
import { GazeVisualizer } from '@/components/assessment/GazeVisualizer';
import { GazeTutor } from '@/components/assessment/GazeTutor';
import { StallIndicator } from '@/components/assessment/StallIndicator';
import { GazeHeatmapCanvas } from '@/components/assessment/GazeHeatmapCanvas';
import { AdaptiveTextDisplay } from '@/components/reading/AdaptiveTextDisplay';
import { AdaptiveReadingContainer } from '@/components/reading/AdaptiveReadingContainer';
import { DiagnosticResults } from '@/components/dashboard/DiagnosticResults';
import { PDFReportGenerator } from '@/components/reports/PDFReportGenerator';
import { HandwritingUpload } from '@/components/handwriting/HandwritingUpload';
import { StudentIntakeModal, StudentIntakeData } from '@/components/assessment/StudentIntakeModal';
import { SessionRecoveryModal } from '@/components/session/SessionRecoveryModal';
import { BrowserCompatibilityAlert } from '@/components/alerts/BrowserCompatibilityAlert';
import { EyeTrackingDebugOverlay } from '@/components/assessment/EyeTrackingDebugOverlay';
import { useAssessmentController } from '@/hooks/useAssessmentController';
import { useSessionPersistence } from '@/hooks/useSessionPersistence';
import { useRealTimeNotifications } from '@/hooks/useRealTimeNotifications';
import { getPassageForGrade } from '@/data/readingPassages';
import { getRegionalPassageForGrade, availableLanguages, getSpeechLocale } from '@/data/regionalPassages';
import { 
  Eye, 
  Mic, 
  Play, 
  Square, 
  RotateCcw, 
  CheckCircle,
  ArrowRight,
  Camera,
  Volume2,
  FileText,
  Brain,
  PenTool,
  Loader2,
  SkipForward,
  Shield
} from 'lucide-react';

export default function AssessmentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get studentId from URL if present
  const urlStudentId = searchParams.get('studentId');
  
  // Student intake state
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [studentData, setStudentData] = useState<StudentIntakeData & { language?: string } | null>(null);
  
  // Session persistence
  const sessionPersistence = useSessionPersistence();
  const { notifyAssessmentComplete } = useRealTimeNotifications();
  
  // Get grade-appropriate reading passage based on language
  const readingPassage = studentData 
    ? studentData.language && studentData.language !== 'en'
      ? getRegionalPassageForGrade(studentData.language as 'hi' | 'ta' | 'te', studentData.grade)
      : getPassageForGrade(studentData.grade) 
    : getPassageForGrade('2nd-3rd Grade');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const gazeHeatmapRef = useRef<HTMLCanvasElement>(null);
  const [showGazeViz, setShowGazeViz] = useState(false);
  const [showBalloonCalibration, setShowBalloonCalibration] = useState(false);
  const [showBiometricPreCheck, setShowBiometricPreCheck] = useState(false);
  const [biometricPassed, setBiometricPassed] = useState(false);
  
  // Reading completion gate state
  const [readingStartTime, setReadingStartTime] = useState<number | null>(null);
  const [readingElapsed, setReadingElapsed] = useState(0);
  const MINIMUM_READING_SECONDS = 30;
  const MINIMUM_FIXATIONS = 10;
  
  const controller = useAssessmentController({
    studentId: urlStudentId || undefined,
    studentName: studentData?.name || 'Student',
    studentAge: studentData?.age || 10,
    studentGrade: studentData?.grade || '4th Grade',
    onComplete: (result) => {
      // Notify via real-time notifications
      notifyAssessmentComplete({
        overallRisk: result.overallRiskLevel === 'high' ? 0.8 : result.overallRiskLevel === 'moderate' ? 0.5 : 0.2,
        fluencyScore: result.voice?.wordsPerMinute || 0
      });
      // Clear session on completion
      sessionPersistence.clearSession();
    }
  });

  // Track reading time for completion gate
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (controller.step === 'reading' && readingStartTime) {
      interval = setInterval(() => {
        setReadingElapsed(Math.floor((Date.now() - readingStartTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [controller.step, readingStartTime]);

  // Set reading start time when entering reading step
  useEffect(() => {
    if (controller.step === 'reading' && !readingStartTime) {
      setReadingStartTime(Date.now());
    }
  }, [controller.step, readingStartTime]);

  // Auto-save during assessment
  useEffect(() => {
    if (controller.step === 'reading' || controller.step === 'voice') {
      sessionPersistence.startAutoSave(() => ({
        step: controller.step,
        transcript: controller.speechRecognition.transcript,
        fixations: controller.eyeTracking.fixations,
        saccades: controller.eyeTracking.saccades,
        readingElapsed
      }));
    }
    return () => sessionPersistence.stopAutoSave();
  }, [controller.step, readingElapsed]);

  // Check if reading requirements are met
  const readingRequirementsMet = 
    readingElapsed >= MINIMUM_READING_SECONDS && 
    controller.eyeTracking.fixations.length >= MINIMUM_FIXATIONS;

  // Check if voice requirements are met (at least 50 characters of transcript)
  const voiceRequirementsMet = controller.speechRecognition.transcript.length >= 50;

  // Show intake modal when Begin Assessment is clicked
  const handleBeginClick = useCallback(() => {
    setShowIntakeModal(true);
  }, []);

  // Handle student intake submission
  const handleIntakeSubmit = useCallback((data: StudentIntakeData & { language?: string }) => {
    setStudentData(data);
    setShowIntakeModal(false);
    
    // Create session for persistence
    sessionPersistence.createSession({
      studentId: urlStudentId,
      studentName: data.name,
      studentAge: data.age,
      studentGrade: data.grade
    });
    
    setShowBiometricPreCheck(true);
  }, [urlStudentId, sessionPersistence]);

  const handleBiometricPass = useCallback((_videoElement: HTMLVideoElement) => {
    setShowBiometricPreCheck(false);
    setBiometricPassed(true);
    setShowBalloonCalibration(true);
    controller.startAssessment();
  }, [controller]);

  const handleCalibrationComplete = useCallback(async () => {
    setShowBalloonCalibration(false);
    await controller.handleCalibrationComplete();
  }, [controller]);

  // Handle session recovery
  const handleRecoverSession = useCallback(() => {
    const session = sessionPersistence.recoverSession();
    if (session) {
      setStudentData({
        name: session.studentName,
        age: session.studentAge,
        grade: session.studentGrade
      });
      setReadingElapsed(session.readingElapsed);
      // Resume from saved step
      controller.startAssessment();
    }
  }, [sessionPersistence, controller]);

  const steps = ['intro', 'calibration', 'reading', 'voice', 'handwriting', 'processing', 'results'];
  const currentStepIndex = steps.indexOf(controller.step);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container">
          {/* Browser Compatibility Alerts */}
          <BrowserCompatibilityAlert feature="speech" />
          <BrowserCompatibilityAlert feature="camera" />
          
          {/* Session Recovery Modal */}
          <SessionRecoveryModal
            isOpen={sessionPersistence.hasRecoverableSession}
            onRecover={handleRecoverSession}
            onDiscard={sessionPersistence.discardRecoveredSession}
            sessionData={sessionPersistence.recoveredSession ? {
              studentName: sessionPersistence.recoveredSession.studentName,
              step: sessionPersistence.recoveredSession.step,
              lastSavedAt: sessionPersistence.recoveredSession.lastSavedAt,
              readingElapsed: sessionPersistence.recoveredSession.readingElapsed
            } : null}
          />
          
          {/* Progress indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              {steps.filter(s => s !== 'processing').map((s, i) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      controller.step === s || (controller.step === 'processing' && s === 'results')
                        ? 'bg-primary text-primary-foreground'
                        : i < currentStepIndex
                          ? 'bg-success text-success-foreground'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {i < currentStepIndex && controller.step !== 'processing' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < steps.filter(s => s !== 'processing').length - 1 && (
                    <div
                      className={`w-12 h-1 mx-1 rounded ${
                        i < currentStepIndex
                          ? 'bg-success'
                          : 'bg-muted'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="text-center text-sm text-muted-foreground">
              {controller.step === 'intro' && 'Introduction'}
              {controller.step === 'calibration' && 'Eye Calibration'}
              {controller.step === 'reading' && 'Reading Assessment'}
              {controller.step === 'voice' && 'Voice Analysis'}
              {controller.step === 'handwriting' && 'Handwriting Analysis'}
              {controller.step === 'processing' && 'Processing Results...'}
              {controller.step === 'results' && 'Results'}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* Intro Step */}
            {controller.step === 'intro' && (
              <motion.div
                key="intro"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-3xl mx-auto text-center"
              >
                <div className="w-20 h-20 rounded-2xl bg-gradient-neuro flex items-center justify-center mx-auto mb-6">
                  <Brain className="w-10 h-10 text-primary-foreground" />
                </div>
                <h1 className="text-4xl font-bold mb-4">
                  Multimodal <span className="text-gradient-neuro">Diagnostic Assessment</span>
                </h1>
                <p className="text-xl text-muted-foreground mb-8">
                  This assessment combines eye tracking, voice analysis, and handwriting analysis
                  to provide a comprehensive evaluation. It takes approximately 5-10 minutes.
                </p>

                <div className="grid md:grid-cols-4 gap-4 mb-8">
                  {[
                    { icon: Shield, title: 'Biometric Check', desc: 'Environment validation' },
                    { icon: Camera, title: 'Eye Tracking', desc: 'Webcam required' },
                    { icon: Volume2, title: 'Voice Analysis', desc: 'Microphone required' },
                    { icon: PenTool, title: 'Handwriting', desc: 'Optional upload' },
                  ].map((item) => (
                    <Card key={item.title}>
                      <CardContent className="p-6 text-center">
                        <item.icon className="w-8 h-8 mx-auto mb-3 text-primary" />
                        <h3 className="font-semibold mb-1">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Language support notice */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border mb-8 text-sm text-muted-foreground">
                  <p className="mb-2">
                    <strong>Regional Language Support:</strong> Assessment available in {availableLanguages.map(l => l.nativeName).join(', ')}
                  </p>
                  <p>
                    Using ETDD70 Universal Dataset thresholds, calibrated for clinical 
                    standards comparable to IIT Madras research protocols.
                  </p>
                </div>

                <Button 
                  variant="hero" 
                  size="xl" 
                  onClick={handleBeginClick}
                  disabled={biometricPassed}
                >
                  Begin Assessment
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </motion.div>
            )}

            {/* Reading Step - GHOST MODE: No visible tracking UI for student */}
            {controller.step === 'reading' && (
              <motion.div
                key="reading"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                ref={containerRef}
              >
                <div className="max-w-4xl mx-auto">
                  {/* Hidden cognitive load indicator - only visible to clinician */}
                  <div className="mb-4 flex items-center justify-between opacity-50 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-3">
                      <Brain className={`w-5 h-5 ${
                        controller.cognitiveLoad.currentLoad === 'high' 
                          ? 'text-destructive' 
                          : controller.cognitiveLoad.currentLoad === 'moderate'
                            ? 'text-warning'
                            : 'text-success'
                      }`} />
                      <span className="text-sm">
                        Cognitive Load: 
                        <span className={`ml-2 font-medium capitalize ${
                          controller.cognitiveLoad.currentLoad === 'high' 
                            ? 'text-destructive' 
                            : controller.cognitiveLoad.currentLoad === 'moderate'
                              ? 'text-warning'
                              : 'text-success'
                        }`}>
                          {controller.cognitiveLoad.currentLoad}
                        </span>
                      </span>
                    </div>
                    {controller.cognitiveLoad.overloadEvents.length > 0 && (
                      <span className="text-sm text-warning">
                        {controller.cognitiveLoad.overloadEvents.length} overload event(s)
                      </span>
                    )}
                  </div>

                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5 text-primary" />
                        Reading Assessment
                        {studentData?.language && studentData.language !== 'en' && (
                          <span className="ml-2 text-sm font-normal text-muted-foreground">
                            ({availableLanguages.find(l => l.code === studentData.language)?.nativeName})
                          </span>
                        )}
                        {/* Ghost indicator - tracking is active but hidden */}
                        <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${controller.eyeTracking.isTracking ? 'bg-success animate-pulse' : 'bg-muted'}`} />
                          Ghost Mode Active
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4">
                        Read the following text at your normal pace.
                      </p>
                      {/* Clean reading container - no visible gaze indicators */}
                      {/* Student info banner */}
                      {studentData && (
                        <div className="mb-4 p-3 rounded-lg bg-muted/50 text-sm flex items-center justify-between">
                          <span>Student: <strong>{studentData.name}</strong> | Grade: {studentData.grade} | Age: {studentData.age}</span>
                          <span className="text-muted-foreground">{readingPassage.wordCount} words</span>
                        </div>
                      )}
                      
                      <AdaptiveReadingContainer
                        eyeTrackingChaos={controller.eyeTracking.getMetrics().chaosIndex}
                        fixationDuration={controller.eyeTracking.getMetrics().averageFixationDuration}
                        regressionRate={controller.eyeTracking.getMetrics().regressionCount / Math.max(controller.eyeTracking.fixations.length, 1)}
                        className="rounded-xl"
                      >
                        <AdaptiveTextDisplay
                          text={readingPassage.text}
                          gazePosition={controller.eyeTracking.currentGaze}
                        />
                      </AdaptiveReadingContainer>
                    </CardContent>
                  </Card>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Clinician-only toggle for gaze visualization */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowGazeViz(!showGazeViz)}
                        className="text-xs opacity-50 hover:opacity-100"
                      >
                        {showGazeViz ? 'Hide' : 'Show'} Debug View
                      </Button>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Reading completion progress */}
                      <div className="text-sm text-muted-foreground">
                        <span className={readingElapsed >= MINIMUM_READING_SECONDS ? 'text-success' : ''}>
                          {readingElapsed}s / {MINIMUM_READING_SECONDS}s
                        </span>
                        {' | '}
                        <span className={controller.eyeTracking.fixations.length >= MINIMUM_FIXATIONS ? 'text-success' : ''}>
                          {controller.eyeTracking.fixations.length} / {MINIMUM_FIXATIONS} fixations
                        </span>
                      </div>
                      <Button 
                        variant="hero" 
                        onClick={controller.startVoiceTest}
                        disabled={!readingRequirementsMet}
                      >
                        {readingRequirementsMet ? (
                          <>
                            Continue to Voice Test
                            <ArrowRight className="w-5 h-5" />
                          </>
                        ) : (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Complete Reading First
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Debug gaze visualization - hidden by default (Ghost Mode) */}
                {showGazeViz && (
                  <GazeVisualizer
                    gazeData={controller.eyeTracking.gazeData}
                    fixations={controller.eyeTracking.fixations}
                    currentGaze={controller.eyeTracking.currentGaze}
                    containerRef={containerRef}
                  />
                )}

                {/* Gaze Tutor - appears when user is stuck on a word */}
                <GazeTutor
                  word={controller.stallWord}
                  position={controller.stallPosition}
                  duration={controller.stallDuration}
                />

                {/* Eye Tracking Debug Overlay - Toggle with Ctrl+Shift+D */}
                <EyeTrackingDebugOverlay
                  debugInfo={controller.eyeTracking.debugInfo}
                  isCalibrated={controller.eyeTracking.isCalibrated}
                  isTracking={controller.eyeTracking.isTracking}
                />
              </motion.div>
            )}

            {/* Voice Step */}
            {controller.step === 'voice' && (
              <motion.div
                key="voice"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto"
              >
                {/* Stall Indicator */}
                <div className="mb-4">
                  <StallIndicator
                    isStalling={controller.speechRecognition.isStalling}
                    duration={controller.speechRecognition.currentStallDuration}
                    lastWord={controller.speechRecognition.stallEvents[controller.speechRecognition.stallEvents.length - 1]?.wordBefore || ''}
                  />
                </div>

                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mic className={`w-5 h-5 ${controller.speechRecognition.isListening ? 'text-destructive animate-pulse' : 'text-primary'}`} />
                      Voice Analysis - {controller.speechRecognition.isListening ? 'Recording' : 'Ready'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      Please read the following text aloud. Speak clearly and at your natural pace.
                    </p>
                    
                    <div className="p-6 rounded-xl bg-muted/50 mb-6">
                      <p className="text-xl leading-relaxed">{readingPassage.text}</p>
                    </div>

                    {/* Transcript display */}
                    {(controller.speechRecognition.transcript || controller.speechRecognition.interimTranscript) && (
                      <div className="p-4 rounded-lg bg-card border border-border mb-6">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Your Reading:</h4>
                        <p className="text-foreground">
                          {controller.speechRecognition.transcript}
                          <span className="text-muted-foreground">{controller.speechRecognition.interimTranscript}</span>
                        </p>
                      </div>
                    )}

                    {/* Stall Events Log */}
                    {controller.speechRecognition.stallEvents.length > 0 && (
                      <div className="p-4 rounded-lg bg-warning/10 border border-warning/20 mb-6">
                        <h4 className="text-sm font-medium text-warning mb-2">
                          Detected Hesitations ({controller.speechRecognition.stallEvents.length})
                        </h4>
                        <div className="space-y-1">
                          {controller.speechRecognition.stallEvents.slice(-5).map((stall, i) => (
                            <p key={i} className="text-sm text-muted-foreground">
                              {(stall.duration / 1000).toFixed(1)}s pause after "{stall.wordBefore}"
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      {!controller.speechRecognition.isListening ? (
                        <Button variant="hero" onClick={controller.speechRecognition.start}>
                          <Play className="w-4 h-4" />
                          Start Recording
                        </Button>
                      ) : (
                        <Button variant="destructive" onClick={controller.speechRecognition.stop}>
                          <Square className="w-4 h-4" />
                          Stop Recording
                        </Button>
                      )}
                      <Button variant="outline" onClick={controller.speechRecognition.reset}>
                        <RotateCcw className="w-4 h-4" />
                        Reset
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={controller.startHandwritingTest}>
                    <PenTool className="w-4 h-4" />
                    Add Handwriting Sample
                  </Button>
                  <Button 
                    variant="hero" 
                    onClick={controller.finishAssessment}
                    disabled={!voiceRequirementsMet}
                  >
                    {voiceRequirementsMet ? (
                      <>
                        Complete Assessment
                        <CheckCircle className="w-5 h-5" />
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Record Voice First ({controller.speechRecognition.transcript.length}/50 chars)
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Handwriting Step */}
            {controller.step === 'handwriting' && (
              <motion.div
                key="handwriting"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto"
              >
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PenTool className="w-5 h-5 text-primary" />
                      Handwriting Analysis (Optional)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-6">
                      Upload a sample of handwriting for analysis. This helps detect character reversals,
                      letter crowding, and other graphomotor indicators.
                    </p>
                    
                    <HandwritingUpload
                      onAnalysisComplete={controller.handleHandwritingComplete}
                    />

                    {controller.handwritingAnalysis.recognizedText && (
                      <div className="mt-6 p-4 rounded-lg bg-muted">
                        <h4 className="text-sm font-medium mb-2">Recognized Text:</h4>
                        <p className="text-sm text-muted-foreground">
                          {controller.handwritingAnalysis.recognizedText}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={controller.skipHandwritingTest}>
                    <SkipForward className="w-4 h-4" />
                    Skip This Step
                  </Button>
                  <Button variant="hero" onClick={controller.finishAssessment}>
                    Complete Assessment
                    <CheckCircle className="w-5 h-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Processing Step */}
            {controller.step === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-md mx-auto text-center py-16"
              >
                <div className="w-20 h-20 rounded-2xl bg-gradient-neuro flex items-center justify-center mx-auto mb-6">
                  <Loader2 className="w-10 h-10 text-primary-foreground animate-spin" />
                </div>
                <h2 className="text-2xl font-bold mb-4">Processing Assessment Data</h2>
                <p className="text-muted-foreground mb-6">
                  Analyzing eye tracking patterns, voice metrics, and calculating diagnostic indices...
                </p>
                <Progress value={66} className="w-64 mx-auto" />
              </motion.div>
            )}

            {/* Results Step */}
            {controller.step === 'results' && controller.result && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <DiagnosticResults result={controller.result} />
                
                {/* Gaze Heatmap Visualization */}
                {controller.eyeTracking.fixations.length > 0 && (
                  <Card className="mt-8">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5 text-primary" />
                        Gaze Heatmap Visualization
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <GazeHeatmapCanvas
                        ref={gazeHeatmapRef}
                        fixations={controller.eyeTracking.fixations}
                        saccades={controller.eyeTracking.saccades}
                        width={800}
                        height={400}
                        className="w-full"
                      />
                    </CardContent>
                  </Card>
                )}
                
                {/* PDF Report Generator */}
                <div className="mt-8">
                  <PDFReportGenerator
                    studentName={studentData?.name || 'Student'}
                    studentAge={studentData?.age || 10}
                    studentGrade={studentData?.grade || '4th Grade'}
                    eyeMetrics={controller.eyeMetrics}
                    voiceMetrics={controller.voiceMetrics}
                    handwritingMetrics={controller.handwritingMetrics}
                    dyslexiaIndex={controller.result.dyslexiaProbabilityIndex * 100}
                    adhdIndex={controller.result.adhdProbabilityIndex * 100}
                    dysgraphiaIndex={controller.result.dysgraphiaProbabilityIndex * 100}
                    overallRisk={controller.result.overallRiskLevel}
                    gazeHeatmapRef={gazeHeatmapRef}
                  />
                </div>
                
                <div className="flex justify-center gap-4 mt-8">
                  <Button variant="outline" onClick={controller.resetAssessment}>
                    <RotateCcw className="w-4 h-4" />
                    Start New Assessment
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Student Intake Modal */}
      <StudentIntakeModal
        isOpen={showIntakeModal}
        onClose={() => setShowIntakeModal(false)}
        onSubmit={handleIntakeSubmit}
      />

      {/* Biometric Pre-Check Overlay - No skip option */}
      <AnimatePresence>
        {showBiometricPreCheck && (
          <BiometricPreCheck
            onReady={handleBiometricPass}
          />
        )}
      </AnimatePresence>

      {/* Balloon Calibration Overlay - No skip option */}
      <AnimatePresence>
        {showBalloonCalibration && (
          <BalloonCalibration
            onComplete={handleCalibrationComplete}
          />
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
