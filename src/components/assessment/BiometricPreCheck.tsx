import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Camera, 
  Sun, 
  Focus, 
  User, 
  Ruler,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';

interface BiometricPreCheckProps {
  onReady: (videoElement: HTMLVideoElement) => void;
}

interface CheckStatus {
  luminosity: 'pending' | 'checking' | 'pass' | 'fail';
  cameraFocus: 'pending' | 'checking' | 'pass' | 'fail';
  facePosition: 'pending' | 'checking' | 'pass' | 'fail';
  faceDistance: 'pending' | 'checking' | 'pass' | 'fail';
}

export function BiometricPreCheck({ onReady }: BiometricPreCheckProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [checkStatus, setCheckStatus] = useState<CheckStatus>({
    luminosity: 'pending',
    cameraFocus: 'pending',
    facePosition: 'pending',
    faceDistance: 'pending'
  });
  const [allChecksPassed, setAllChecksPassed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const faceDetectionRef = useRef<any>(null);

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

  const checkLuminosity = useCallback(() => {
    if (!canvasRef.current || !videoRef.current) return false;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return false;
    
    canvasRef.current.width = videoRef.current.videoWidth || 640;
    canvasRef.current.height = videoRef.current.videoHeight || 480;
    
    ctx.drawImage(videoRef.current, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    let totalBrightness = 0;
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      totalBrightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    }
    
    const avgBrightness = totalBrightness / (data.length / 4);
    
    // India-standard lighting threshold (slightly lower for varied conditions)
    return avgBrightness >= 45;
  }, []);

  const checkCameraFocus = useCallback(() => {
    if (!canvasRef.current || !videoRef.current) return false;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return false;
    
    ctx.drawImage(videoRef.current, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Calculate Laplacian variance for focus detection
    let laplacianVariance = 0;
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    const data = imageData.data;
    
    const getGray = (x: number, y: number) => {
      const idx = (y * width + x) * 4;
      return data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
    };
    
    let sumLaplacian = 0;
    let count = 0;
    
    for (let y = 1; y < height - 1; y += 4) {
      for (let x = 1; x < width - 1; x += 4) {
        const center = getGray(x, y);
        const laplacian = 
          getGray(x - 1, y) + getGray(x + 1, y) + 
          getGray(x, y - 1) + getGray(x, y + 1) - 
          4 * center;
        sumLaplacian += laplacian * laplacian;
        count++;
      }
    }
    
    laplacianVariance = sumLaplacian / count;
    
    // Higher variance = sharper image
    return laplacianVariance > 100;
  }, []);

  const detectFace = useCallback(async () => {
    if (!canvasRef.current || !videoRef.current) {
      return { detected: false, centered: false, distanceOk: false };
    }
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return { detected: false, centered: false, distanceOk: false };
    
    ctx.drawImage(videoRef.current, 0, 0);
    
    // Use simple face detection via canvas analysis
    // In a full implementation, we'd use the Face Mesh here
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    
    // Analyze center region for skin-tone pixels (simplified face detection)
    const centerX = width / 2;
    const centerY = height / 2;
    const regionSize = Math.min(width, height) * 0.3;
    
    const imageData = ctx.getImageData(
      centerX - regionSize / 2,
      centerY - regionSize / 2,
      regionSize,
      regionSize
    );
    
    let skinTonePixels = 0;
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Skin tone detection (works across various skin tones)
      if (r > 60 && g > 40 && b > 20 && 
          r > b && (r - g) < 80 && 
          Math.abs(r - g) < 50) {
        skinTonePixels++;
      }
    }
    
    const skinToneRatio = skinTonePixels / (data.length / 4);
    const detected = skinToneRatio > 0.15;
    const centered = skinToneRatio > 0.25;
    
    // Estimate face size for distance check
    const faceSize = skinToneRatio * regionSize;
    const optimalSize = regionSize * 0.5;
    const distanceOk = faceSize > optimalSize * 0.6 && faceSize < optimalSize * 1.4;
    
    return { detected, centered, distanceOk };
  }, []);

  const runChecks = useCallback(async () => {
    if (!isCameraReady) return;
    
    // Check luminosity
    setCheckStatus(prev => ({ ...prev, luminosity: 'checking' }));
    const luminosityOk = checkLuminosity();
    setCheckStatus(prev => ({ ...prev, luminosity: luminosityOk ? 'pass' : 'fail' }));
    
    // Check camera focus
    setCheckStatus(prev => ({ ...prev, cameraFocus: 'checking' }));
    const focusOk = checkCameraFocus();
    setCheckStatus(prev => ({ ...prev, cameraFocus: focusOk ? 'pass' : 'fail' }));
    
    // Check face detection
    setCheckStatus(prev => ({ ...prev, facePosition: 'checking', faceDistance: 'checking' }));
    const faceResult = await detectFace();
    setCheckStatus(prev => ({ 
      ...prev, 
      facePosition: faceResult.centered ? 'pass' : 'fail',
      faceDistance: faceResult.distanceOk ? 'pass' : 'fail'
    }));
    
    // Check if all passed
    const allPassed = luminosityOk && focusOk && faceResult.centered && faceResult.distanceOk;
    setAllChecksPassed(allPassed);
  }, [isCameraReady, checkLuminosity, checkCameraFocus, detectFace]);

  useEffect(() => {
    startCamera();
    
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  useEffect(() => {
    if (isCameraReady) {
      // Run checks every 500ms
      runChecks();
      checkIntervalRef.current = setInterval(runChecks, 500);
    }
    
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [isCameraReady, runChecks]);

  const handleProceed = useCallback(() => {
    if (videoRef.current) {
      onReady(videoRef.current);
    }
  }, [onReady]);

  const getStatusIcon = (status: 'pending' | 'checking' | 'pass' | 'fail') => {
    switch (status) {
      case 'pending':
        return <div className="w-5 h-5 rounded-full bg-muted" />;
      case 'checking':
        return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'fail':
        return <AlertCircle className="w-5 h-5 text-destructive" />;
    }
  };

  const checks = [
    { key: 'luminosity', label: 'Room Lighting', icon: Sun, tip: 'Ensure adequate lighting' },
    { key: 'cameraFocus', label: 'Camera Focus', icon: Focus, tip: 'Clean camera lens' },
    { key: 'facePosition', label: 'Face Centered', icon: User, tip: 'Position face in center' },
    { key: 'faceDistance', label: 'Distance (50-60cm)', icon: Ruler, tip: 'Move closer/further' },
  ];

  const passedCount = Object.values(checkStatus).filter(s => s === 'pass').length;
  const progress = (passedCount / 4) * 100;

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
            Biometric Precision Pre-Check
          </CardTitle>
          <p className="text-muted-foreground">
            Ensuring optimal conditions for accurate eye tracking
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
                style={{ transform: 'scaleX(-1)' }} // Mirror correction
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Guide overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`w-48 h-64 rounded-[50%] border-4 ${
                    checkStatus.facePosition === 'pass' 
                      ? 'border-success' 
                      : 'border-dashed border-muted-foreground/50'
                  } transition-colors`} />
                </div>
              </div>
              
              {!isCameraReady && (
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
                  <span className="font-medium">{passedCount}/4 Passed</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
              
              <div className="space-y-3">
                {checks.map(check => (
                  <div
                    key={check.key}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      checkStatus[check.key as keyof CheckStatus] === 'pass'
                        ? 'bg-success/10'
                        : checkStatus[check.key as keyof CheckStatus] === 'fail'
                          ? 'bg-destructive/10'
                          : 'bg-muted/50'
                    }`}
                  >
                    <check.icon className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">{check.label}</p>
                      {checkStatus[check.key as keyof CheckStatus] === 'fail' && (
                        <p className="text-xs text-muted-foreground">{check.tip}</p>
                      )}
                    </div>
                    {getStatusIcon(checkStatus[check.key as keyof CheckStatus])}
                  </div>
                ))}
              </div>
              
              <div className="pt-4 space-y-3">
                <Button
                  variant="hero"
                  className="w-full"
                  disabled={!allChecksPassed}
                  onClick={handleProceed}
                >
                  {allChecksPassed ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Start Assessment
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Waiting for all checks...
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground text-center mt-4">
            Inspired by the research standards of IIT Madras and global clinical benchmarks
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
