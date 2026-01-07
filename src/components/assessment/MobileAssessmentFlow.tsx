import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Brain, 
  Camera, 
  Mic, 
  PenTool, 
  CheckCircle, 
  ArrowRight,
  ArrowLeft,
  Volume2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

type AssessmentStep = 'intro' | 'permissions' | 'calibration' | 'reading' | 'voice' | 'handwriting' | 'processing' | 'results';

interface MobileAssessmentFlowProps {
  currentStep: AssessmentStep;
  onStepChange: (step: AssessmentStep) => void;
  onComplete: () => void;
  children: React.ReactNode;
}

const steps = [
  { id: 'intro', label: 'Start', icon: Brain },
  { id: 'permissions', label: 'Setup', icon: Camera },
  { id: 'calibration', label: 'Calibrate', icon: Camera },
  { id: 'reading', label: 'Read', icon: Volume2 },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'handwriting', label: 'Write', icon: PenTool },
  { id: 'processing', label: 'Process', icon: Brain },
  { id: 'results', label: 'Results', icon: CheckCircle },
];

export function MobileAssessmentFlow({ 
  currentStep, 
  onStepChange, 
  onComplete,
  children 
}: MobileAssessmentFlowProps) {
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const goToNext = () => {
    if (currentStepIndex < steps.length - 1) {
      onStepChange(steps[currentStepIndex + 1].id as AssessmentStep);
    } else {
      onComplete();
    }
  };

  const goToPrev = () => {
    if (currentStepIndex > 0) {
      onStepChange(steps[currentStepIndex - 1].id as AssessmentStep);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with progress */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border px-4 py-3 safe-area-top">
        <div className="flex items-center justify-between mb-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={goToPrev}
            disabled={currentStepIndex === 0}
            className="touch-target"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            {(() => {
              const CurrentIcon = steps[currentStepIndex]?.icon;
              return CurrentIcon ? <CurrentIcon className="w-5 h-5 text-primary" /> : null;
            })()}
            <span className="font-medium">{steps[currentStepIndex]?.label}</span>
          </div>
          <div className="w-10" /> {/* Spacer for alignment */}
        </div>
        <Progress value={progress} className="h-1.5" />
      </header>

      {/* Step indicators */}
      <div className="px-4 py-3 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === currentStepIndex;
            const isCompleted = i < currentStepIndex;
            
            return (
              <motion.div
                key={step.id}
                initial={{ scale: 0.9, opacity: 0.5 }}
                animate={{ 
                  scale: isActive ? 1 : 0.9, 
                  opacity: isActive ? 1 : isCompleted ? 0.8 : 0.5 
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                  isActive && 'bg-primary text-primary-foreground',
                  isCompleted && 'bg-success/20 text-success',
                  !isActive && !isCompleted && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <CheckCircle className="w-3.5 h-3.5" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Main content area */}
      <main className="flex-1 px-4 py-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom action bar */}
      <footer className="sticky bottom-0 z-40 bg-background/95 backdrop-blur-lg border-t border-border px-4 py-4 safe-area-bottom">
        <Button 
          variant="hero" 
          size="lg" 
          className="w-full touch-target"
          onClick={goToNext}
        >
          {currentStepIndex === steps.length - 1 ? (
            <>
              <CheckCircle className="w-5 h-5 mr-2" />
              View Results
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </footer>
    </div>
  );
}

// Mobile-optimized intro screen
export function MobileAssessmentIntro({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="w-24 h-24 rounded-3xl bg-gradient-neuro flex items-center justify-center mb-6"
      >
        <Brain className="w-12 h-12 text-primary-foreground" />
      </motion.div>
      
      <h1 className="text-2xl font-bold mb-3">
        Neuro-Read <span className="text-gradient-neuro">Assessment</span>
      </h1>
      
      <p className="text-muted-foreground mb-8 max-w-sm">
        This comprehensive assessment will evaluate reading patterns, voice, and writing to provide personalized insights.
      </p>

      <div className="space-y-3 w-full max-w-xs mb-8">
        {[
          { icon: Camera, text: 'Eye tracking analysis' },
          { icon: Mic, text: 'Voice & phonics test' },
          { icon: PenTool, text: 'Handwriting evaluation' },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-muted/50"
          >
            <item.icon className="w-5 h-5 text-primary" />
            <span className="text-sm">{item.text}</span>
          </motion.div>
        ))}
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg mb-6">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Takes approximately 10-15 minutes. Ensure you're in a quiet, well-lit environment.</span>
      </div>

      <Button variant="hero" size="lg" className="w-full max-w-xs" onClick={onStart}>
        <Brain className="w-5 h-5 mr-2" />
        Begin Assessment
      </Button>
    </div>
  );
}

// Mobile permissions request screen
export function MobilePermissionsRequest({ 
  onGranted, 
  onDenied 
}: { 
  onGranted: () => void; 
  onDenied: () => void 
}) {
  const [cameraGranted, setCameraGranted] = useState(false);
  const [micGranted, setMicGranted] = useState(false);

  const requestCamera = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraGranted(true);
    } catch {
      // Camera denied
    }
  };

  const requestMic = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicGranted(true);
    } catch {
      // Mic denied
    }
  };

  useEffect(() => {
    if (cameraGranted && micGranted) {
      onGranted();
    }
  }, [cameraGranted, micGranted, onGranted]);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold mb-2">Setup Permissions</h2>
        <p className="text-muted-foreground text-sm">
          We need access to your camera and microphone for the assessment
        </p>
      </div>

      <Card className={cn(cameraGranted && 'border-success bg-success/5')}>
        <CardContent className="p-4 flex items-center gap-4">
          <div className={cn(
            'p-3 rounded-xl',
            cameraGranted ? 'bg-success/20' : 'bg-muted'
          )}>
            <Camera className={cn('w-6 h-6', cameraGranted ? 'text-success' : 'text-muted-foreground')} />
          </div>
          <div className="flex-1">
            <p className="font-medium">Camera Access</p>
            <p className="text-xs text-muted-foreground">For eye tracking analysis</p>
          </div>
          {cameraGranted ? (
            <CheckCircle className="w-6 h-6 text-success" />
          ) : (
            <Button size="sm" onClick={requestCamera}>Allow</Button>
          )}
        </CardContent>
      </Card>

      <Card className={cn(micGranted && 'border-success bg-success/5')}>
        <CardContent className="p-4 flex items-center gap-4">
          <div className={cn(
            'p-3 rounded-xl',
            micGranted ? 'bg-success/20' : 'bg-muted'
          )}>
            <Mic className={cn('w-6 h-6', micGranted ? 'text-success' : 'text-muted-foreground')} />
          </div>
          <div className="flex-1">
            <p className="font-medium">Microphone Access</p>
            <p className="text-xs text-muted-foreground">For voice analysis</p>
          </div>
          {micGranted ? (
            <CheckCircle className="w-6 h-6 text-success" />
          ) : (
            <Button size="sm" onClick={requestMic}>Allow</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
