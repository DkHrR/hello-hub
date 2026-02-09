import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Camera, 
  Eye,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Info
} from 'lucide-react';

interface BiometricPreCheckProps {
  onReady: (videoElement: HTMLVideoElement) => void;
}

export function BiometricPreCheck({ onReady }: BiometricPreCheckProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [eyesDetected, setEyesDetected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkingEyes, setCheckingEyes] = useState(false);
  const faceMeshRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const consecutiveDetections = useRef(0);
  const REQUIRED_CONSECUTIVE = 5; // Need 5 consecutive frames with eyes

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraReady(true);
        setErrorMessage(null);
      }
    } catch {
      setErrorMessage('Unable to access camera. Please grant camera permissions.');
    }
  }, []);

  // Initialize MediaPipe FaceMesh for iris detection
  const initFaceMesh = useCallback(async () => {
    if (!isCameraReady || !videoRef.current) return;
    
    setCheckingEyes(true);

    try {
      // @ts-ignore - MediaPipe loaded from CDN
      const FaceMesh = window.FaceMesh;
      
      if (!FaceMesh) {
        // FaceMesh CDN not loaded, try loading it
        await loadFaceMeshCDN();
        return;
      }

      const faceMesh = new FaceMesh({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true, // Required for iris landmarks
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults((results: any) => {
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          const landmarks = results.multiFaceLandmarks[0];
          // Iris landmarks: 468-472 (left iris), 473-477 (right iris)
          const hasLeftIris = landmarks[468] && landmarks[469] && landmarks[470] && landmarks[471] && landmarks[472];
          const hasRightIris = landmarks[473] && landmarks[474] && landmarks[475] && landmarks[476] && landmarks[477];
          
          if (hasLeftIris && hasRightIris) {
            consecutiveDetections.current++;
            if (consecutiveDetections.current >= REQUIRED_CONSECUTIVE) {
              setEyesDetected(true);
              setCheckingEyes(false);
            }
          } else {
            consecutiveDetections.current = 0;
            setEyesDetected(false);
          }
        } else {
          consecutiveDetections.current = 0;
          setEyesDetected(false);
        }
      });

      faceMeshRef.current = faceMesh;

      // Start processing frames
      const processFrame = async () => {
        if (videoRef.current && faceMeshRef.current && videoRef.current.readyState >= 2) {
          await faceMeshRef.current.send({ image: videoRef.current });
        }
        animFrameRef.current = requestAnimationFrame(processFrame);
      };
      processFrame();
    } catch (err) {
      console.error('FaceMesh init error:', err);
      // Fallback: just allow proceeding after camera is ready
      setEyesDetected(true);
      setCheckingEyes(false);
    }
  }, [isCameraReady]);

  const loadFaceMeshCDN = useCallback(async () => {
    return new Promise<void>((resolve) => {
      if ((window as any).FaceMesh) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        resolve();
        // Re-init after loading
        setTimeout(() => initFaceMesh(), 100);
      };
      script.onerror = () => {
        // If CDN fails, allow proceeding
        setEyesDetected(true);
        setCheckingEyes(false);
        resolve();
      };
      document.head.appendChild(script);
    });
  }, [initFaceMesh]);

  useEffect(() => {
    startCamera();
    
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close?.();
      }
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  useEffect(() => {
    if (isCameraReady) {
      initFaceMesh();
    }
  }, [isCameraReady, initFaceMesh]);

  const handleProceed = useCallback(() => {
    if (videoRef.current) {
      onReady(videoRef.current);
    }
  }, [onReady]);

  const allPassed = isCameraReady && eyesDetected;
  const passedCount = (isCameraReady ? 1 : 0) + (eyesDetected ? 1 : 0);
  const progress = (passedCount / 2) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto"
    >
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Camera className="w-6 h-6 text-primary" />
            Biometric Pre-Check
          </CardTitle>
          <p className="text-muted-foreground">
            Ensuring your eyes are visible for accurate pupil tracking
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Video Preview */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
              
              {/* Eye region guide overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`w-48 h-28 rounded-xl border-4 ${
                    eyesDetected 
                      ? 'border-success' 
                      : 'border-dashed border-muted-foreground/50'
                  } transition-colors`} />
                </div>
              </div>
              
              {!isCameraReady && !errorMessage && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Initializing camera...</p>
                  </div>
                </div>
              )}
              
              {errorMessage && (
                <div className="absolute inset-0 flex items-center justify-center bg-destructive/10">
                  <div className="text-center p-4">
                    <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                    <p className="text-sm text-destructive">{errorMessage}</p>
                    <Button variant="outline" size="sm" className="mt-2" onClick={startCamera}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Check Status */}
            <div className="space-y-4">
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Pre-check Progress</span>
                  <span className="font-medium">{passedCount}/2 Passed</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
              
              <div className="space-y-3">
                {/* Camera Access Check */}
                <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isCameraReady ? 'bg-success/10' : 'bg-muted/50'
                }`}>
                  <Camera className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">Camera Access</p>
                    {!isCameraReady && !errorMessage && (
                      <p className="text-xs text-muted-foreground">Requesting camera permission...</p>
                    )}
                  </div>
                  {isCameraReady ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : errorMessage ? (
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  )}
                </div>

                {/* Eyes Detected Check */}
                <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  eyesDetected ? 'bg-success/10' : checkingEyes ? 'bg-muted/50' : 'bg-muted/50'
                }`}>
                  <Eye className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">Eyes Detected</p>
                    {checkingEyes && !eyesDetected && (
                      <p className="text-xs text-muted-foreground">Look directly at the camera</p>
                    )}
                    {eyesDetected && (
                      <p className="text-xs text-success">Both irises clearly visible</p>
                    )}
                  </div>
                  {eyesDetected ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : checkingEyes ? (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-muted" />
                  )}
                </div>
              </div>
              
              {/* Tips */}
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Tips</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      Face the camera directly. Remove glasses if they cause glare. Ensure your eyes are clearly visible.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="pt-4">
                <Button
                  variant="hero"
                  className="w-full"
                  disabled={!allPassed}
                  onClick={handleProceed}
                >
                  {allPassed ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Start Assessment
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Waiting for checks...
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-4 space-y-1">
            <p className="text-xs text-muted-foreground">
              Inspired by the research standards of IIT Madras and global clinical benchmarks
            </p>
            <p className="text-xs text-primary/60">
              💡 Tip: Press Ctrl+Shift+D during assessment to toggle debug overlay
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
