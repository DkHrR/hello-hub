import { useState, useCallback, useRef, useEffect } from 'react';
import type { CognitiveLoadMetrics } from '@/types/diagnostic';

interface PupilMeasurement {
  timestamp: number;
  leftPupilSize: number;
  rightPupilSize: number;
  averageSize: number;
  leftIrisRatio: number;
  rightIrisRatio: number;
}

interface BiometricChecks {
  luminosity: boolean;
  cameraFocus: boolean;
  facePosition: boolean;
  faceDistance: boolean;
}

// Iris landmark indices for MediaPipe Face Mesh
const LEFT_IRIS_INDICES = [468, 469, 470, 471, 472];
const RIGHT_IRIS_INDICES = [473, 474, 475, 476, 477];
const LEFT_EYE_INDICES = [33, 133, 160, 159, 158, 144, 145, 153];
const RIGHT_EYE_INDICES = [362, 263, 387, 386, 385, 373, 374, 380];

export function useFaceMeshPupilTracking() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentLoad, setCurrentLoad] = useState<'low' | 'moderate' | 'high'>('low');
  const [measurements, setMeasurements] = useState<PupilMeasurement[]>([]);
  const [overloadEvents, setOverloadEvents] = useState<{ timestamp: number; duration: number }[]>([]);
  const [biometricChecks, setBiometricChecks] = useState<BiometricChecks>({
    luminosity: false,
    cameraFocus: false,
    facePosition: false,
    faceDistance: false
  });
  const [isBiometricReady, setIsBiometricReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceMeshRef = useRef<any>(null);
  const baselinePupilSizeRef = useRef<number | null>(null);
  const overloadStartRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastLandmarksRef = useRef<any>(null);
  
  // Thresholds based on clinical research
  const DILATION_MODERATE_THRESHOLD = 1.15;
  const DILATION_HIGH_THRESHOLD = 1.30;
  const OVERLOAD_DURATION_THRESHOLD = 3000;
  const MIN_LUMINOSITY = 50;
  const OPTIMAL_FACE_DISTANCE_MIN = 0.15;
  const OPTIMAL_FACE_DISTANCE_MAX = 0.35;

  const calculatePupilIrisRatio = useCallback((landmarks: any[], irisIndices: number[], eyeIndices: number[]) => {
    if (!landmarks || landmarks.length === 0) return 0;
    
    try {
      // Get iris landmarks
      const irisPoints = irisIndices.map(i => landmarks[i]).filter(Boolean);
      if (irisPoints.length < 4) return 0;
      
      // Calculate iris diameter
      const irisCenter = {
        x: irisPoints.reduce((sum, p) => sum + p.x, 0) / irisPoints.length,
        y: irisPoints.reduce((sum, p) => sum + p.y, 0) / irisPoints.length
      };
      
      const irisRadius = irisPoints.reduce((sum, p) => {
        const dx = p.x - irisCenter.x;
        const dy = p.y - irisCenter.y;
        return sum + Math.sqrt(dx * dx + dy * dy);
      }, 0) / irisPoints.length;
      
      // Get eye landmarks for reference
      const eyePoints = eyeIndices.map(i => landmarks[i]).filter(Boolean);
      if (eyePoints.length < 4) return irisRadius * 2;
      
      // Calculate eye width for normalization
      const eyeWidth = Math.abs(eyePoints[0].x - eyePoints[eyePoints.length / 2].x);
      
      // Pupil-to-iris ratio (mydriasis indicator)
      return eyeWidth > 0 ? (irisRadius * 2) / eyeWidth : 0;
    } catch (e) {
      return 0;
    }
  }, []);

  const checkBiometricConditions = useCallback((landmarks: any[], imageData?: ImageData) => {
    const checks: BiometricChecks = {
      luminosity: false,
      cameraFocus: true, // Assume good by default
      facePosition: false,
      faceDistance: false
    };
    
    if (!landmarks || landmarks.length === 0) {
      setBiometricChecks(checks);
      setIsBiometricReady(false);
      return checks;
    }
    
    // Check face position (nose tip should be centered)
    const noseTip = landmarks[1];
    if (noseTip) {
      const centerX = 0.5;
      const centerY = 0.5;
      const distanceFromCenter = Math.sqrt(
        Math.pow(noseTip.x - centerX, 2) + 
        Math.pow(noseTip.y - centerY, 2)
      );
      checks.facePosition = distanceFromCenter < 0.2;
    }
    
    // Check face distance using face width
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];
    if (leftCheek && rightCheek) {
      const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
      checks.faceDistance = faceWidth >= OPTIMAL_FACE_DISTANCE_MIN && faceWidth <= OPTIMAL_FACE_DISTANCE_MAX;
    }
    
    // Check luminosity from image data
    if (imageData) {
      const data = imageData.data;
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      const avgBrightness = totalBrightness / (data.length / 4);
      checks.luminosity = avgBrightness >= MIN_LUMINOSITY;
    } else {
      checks.luminosity = true; // Assume good if can't measure
    }
    
    setBiometricChecks(checks);
    const allChecksPassed = Object.values(checks).every(Boolean);
    setIsBiometricReady(allChecksPassed);
    
    return checks;
  }, []);

  const processLandmarks = useCallback((landmarks: any[]) => {
    if (!landmarks || landmarks.length === 0) return;
    
    lastLandmarksRef.current = landmarks;
    
    // Calculate pupil-to-iris ratios for both eyes
    const leftRatio = calculatePupilIrisRatio(landmarks, LEFT_IRIS_INDICES, LEFT_EYE_INDICES);
    const rightRatio = calculatePupilIrisRatio(landmarks, RIGHT_IRIS_INDICES, RIGHT_EYE_INDICES);
    
    if (leftRatio === 0 && rightRatio === 0) return;
    
    const avgRatio = (leftRatio + rightRatio) / 2;
    
    const measurement: PupilMeasurement = {
      timestamp: Date.now(),
      leftPupilSize: leftRatio * 100,
      rightPupilSize: rightRatio * 100,
      averageSize: avgRatio * 100,
      leftIrisRatio: leftRatio,
      rightIrisRatio: rightRatio
    };
    
    setMeasurements(prev => [...prev.slice(-300), measurement]);
    
    // Establish baseline from first 30 measurements
    if (!baselinePupilSizeRef.current && measurements.length >= 30) {
      const recent = measurements.slice(-30);
      baselinePupilSizeRef.current = recent.reduce((sum, m) => sum + m.averageSize, 0) / 30;
    }
    
    // Detect cognitive load
    if (baselinePupilSizeRef.current) {
      const dilationRatio = measurement.averageSize / baselinePupilSizeRef.current;
      
      let newLoad: 'low' | 'moderate' | 'high' = 'low';
      if (dilationRatio >= DILATION_HIGH_THRESHOLD) {
        newLoad = 'high';
      } else if (dilationRatio >= DILATION_MODERATE_THRESHOLD) {
        newLoad = 'moderate';
      }
      
      setCurrentLoad(newLoad);
      
      // Track overload events
      if (newLoad === 'high') {
        if (!overloadStartRef.current) {
          overloadStartRef.current = Date.now();
        } else {
          const overloadDuration = Date.now() - overloadStartRef.current;
          if (overloadDuration >= OVERLOAD_DURATION_THRESHOLD) {
            setOverloadEvents(prev => {
              const lastEvent = prev[prev.length - 1];
              if (!lastEvent || lastEvent.timestamp !== overloadStartRef.current) {
                return [...prev, { 
                  timestamp: overloadStartRef.current!, 
                  duration: overloadDuration 
                }];
              }
              return [
                ...prev.slice(0, -1),
                { ...lastEvent, duration: overloadDuration }
              ];
            });
          }
        }
      } else {
        overloadStartRef.current = null;
      }
    }
    
    // Check biometric conditions
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx && videoRef.current) {
        const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
        checkBiometricConditions(landmarks, imageData);
      }
    } else {
      checkBiometricConditions(landmarks);
    }
  }, [measurements, calculatePupilIrisRatio, checkBiometricConditions]);

  const initialize = useCallback(async (video: HTMLVideoElement, canvas?: HTMLCanvasElement) => {
    videoRef.current = video;
    if (canvas) canvasRef.current = canvas;
    
    try {
      // Import MediaPipe Face Mesh from npm package
      const FaceMeshModule = await import('@mediapipe/face_mesh');
      const FaceMesh = FaceMeshModule.FaceMesh;
      
      const faceMesh = new FaceMesh({
        locateFile: (file: string) => {
          // Use CDN for production-safe asset loading
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
        }
      });
      
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true, // Enable iris tracking
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      
      faceMesh.onResults((results: { multiFaceLandmarks?: unknown[][] }) => {
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          processLandmarks(results.multiFaceLandmarks[0]);
        }
      });
      
      faceMeshRef.current = faceMesh;
      setIsInitialized(true);
      
      return true;
    } catch {
      // Failed to initialize Face Mesh - will fall back to simulated data
      return false;
    }
  }, [processLandmarks]);

  const startMonitoring = useCallback(async () => {
    if (!isInitialized || !faceMeshRef.current || !videoRef.current) {
      return;
    }
    
    setIsMonitoring(true);
    setMeasurements([]);
    setOverloadEvents([]);
    baselinePupilSizeRef.current = null;
    overloadStartRef.current = null;
    
    const processFrame = async () => {
      if (!isMonitoring || !faceMeshRef.current || !videoRef.current) return;
      
      if (videoRef.current.readyState >= 2) {
        await faceMeshRef.current.send({ image: videoRef.current });
      }
      
      animationFrameRef.current = requestAnimationFrame(processFrame);
    };
    
    processFrame();
  }, [isInitialized, isMonitoring]);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const getMetrics = useCallback((): CognitiveLoadMetrics => {
    if (measurements.length === 0) {
      return {
        averagePupilDilation: 0,
        overloadEvents: 0,
        stressIndicators: 0
      };
    }

    const baseline = baselinePupilSizeRef.current || measurements[0].averageSize;
    
    const dilationRatios = measurements.map(m => m.averageSize / baseline);
    const avgDilation = dilationRatios.reduce((a, b) => a + b, 0) / dilationRatios.length;
    
    let stressIndicators = 0;
    for (let i = 1; i < measurements.length; i++) {
      const change = Math.abs(measurements[i].averageSize - measurements[i-1].averageSize);
      if (change > 5) { // Threshold for rapid pupil change
        stressIndicators++;
      }
    }
    
    return {
      averagePupilDilation: (avgDilation - 1) * 100,
      overloadEvents: overloadEvents.length,
      stressIndicators
    };
  }, [measurements, overloadEvents]);

  const reset = useCallback(() => {
    stopMonitoring();
    setMeasurements([]);
    setOverloadEvents([]);
    setCurrentLoad('low');
    baselinePupilSizeRef.current = null;
    setBiometricChecks({
      luminosity: false,
      cameraFocus: false,
      facePosition: false,
      faceDistance: false
    });
    setIsBiometricReady(false);
  }, [stopMonitoring]);

  useEffect(() => {
    return () => {
      stopMonitoring();
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
      }
    };
  }, [stopMonitoring]);

  return {
    isInitialized,
    isMonitoring,
    currentLoad,
    measurements,
    overloadEvents,
    biometricChecks,
    isBiometricReady,
    baselinePupilSize: baselinePupilSizeRef.current,
    initialize,
    startMonitoring,
    stopMonitoring,
    getMetrics,
    reset,
    lastLandmarks: lastLandmarksRef.current
  };
}
