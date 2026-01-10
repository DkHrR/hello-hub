import { useState, useEffect, useCallback, useRef } from 'react';
import type { GazePoint, Fixation, Saccade, EyeTrackingMetrics, TrackingBackend, EyeTrackingDebugInfo } from '@/types/diagnostic';

// MediaPipe Face Mesh indices for iris tracking
const LEFT_IRIS_INDICES = [468, 469, 470, 471, 472];
const RIGHT_IRIS_INDICES = [473, 474, 475, 476, 477];
const LEFT_EYE_INDICES = [33, 133, 160, 159, 158, 144, 145, 153];
const RIGHT_EYE_INDICES = [362, 263, 387, 386, 385, 373, 374, 380];

// CDN URL for MediaPipe assets (production-safe)
const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619';

export function useUnifiedEyeTracking() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [gazeData, setGazeData] = useState<GazePoint[]>([]);
  const [fixations, setFixations] = useState<Fixation[]>([]);
  const [saccades, setSaccades] = useState<Saccade[]>([]);
  const [currentGaze, setCurrentGaze] = useState<{ x: number; y: number } | null>(null);
  
  // New state for backend and debug info
  const [activeBackend, setActiveBackend] = useState<TrackingBackend>('none');
  const [debugInfo, setDebugInfo] = useState<EyeTrackingDebugInfo>({
    fps: 0,
    landmarkCount: 0,
    backend: 'none',
    lastFrameTime: 0,
    confidence: 0,
    isProcessing: false
  });

  const faceMeshRef = useRef<any>(null);
  const webgazerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastGazeRef = useRef<GazePoint | null>(null);
  const fixationStartRef = useRef<{ x: number; y: number; timestamp: number } | null>(null);
  const gazeBufferRef = useRef<{ x: number; y: number }[]>([]);
  const calibrationOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // FPS tracking
  const fpsRef = useRef({ frames: 0, lastCheck: Date.now() });
  const initStartTimeRef = useRef<number>(0);

  const FIXATION_THRESHOLD = 30;
  const FIXATION_MIN_DURATION = 100;
  const SMOOTHING_WINDOW = 5;

  // Update FPS counter
  const updateFps = useCallback(() => {
    fpsRef.current.frames++;
    const now = Date.now();
    if (now - fpsRef.current.lastCheck >= 1000) {
      setDebugInfo(prev => ({
        ...prev,
        fps: fpsRef.current.frames,
        lastFrameTime: now
      }));
      fpsRef.current = { frames: 0, lastCheck: now };
    }
  }, []);

  // Calculate gaze position from iris landmarks
  const calculateGazeFromIris = useCallback((landmarks: any[]): { x: number; y: number; confidence: number } | null => {
    if (!landmarks || landmarks.length < 478) return null;

    try {
      const leftIrisPoints = LEFT_IRIS_INDICES.map(i => landmarks[i]).filter(Boolean);
      const rightIrisPoints = RIGHT_IRIS_INDICES.map(i => landmarks[i]).filter(Boolean);

      if (leftIrisPoints.length < 4 || rightIrisPoints.length < 4) return null;

      const leftCenter = {
        x: leftIrisPoints.reduce((sum, p) => sum + p.x, 0) / leftIrisPoints.length,
        y: leftIrisPoints.reduce((sum, p) => sum + p.y, 0) / leftIrisPoints.length
      };

      const rightCenter = {
        x: rightIrisPoints.reduce((sum, p) => sum + p.x, 0) / rightIrisPoints.length,
        y: rightIrisPoints.reduce((sum, p) => sum + p.y, 0) / rightIrisPoints.length
      };

      const leftEyeOuter = landmarks[LEFT_EYE_INDICES[0]];
      const leftEyeInner = landmarks[LEFT_EYE_INDICES[1]];
      const rightEyeOuter = landmarks[RIGHT_EYE_INDICES[0]];
      const rightEyeInner = landmarks[RIGHT_EYE_INDICES[1]];

      if (!leftEyeOuter || !leftEyeInner || !rightEyeOuter || !rightEyeInner) return null;

      const leftEyeWidth = Math.abs(leftEyeInner.x - leftEyeOuter.x);
      const rightEyeWidth = Math.abs(rightEyeInner.x - rightEyeOuter.x);

      const leftRelX = leftEyeWidth > 0 ? (leftCenter.x - leftEyeOuter.x) / leftEyeWidth : 0.5;
      const rightRelX = rightEyeWidth > 0 ? (rightCenter.x - rightEyeOuter.x) / rightEyeWidth : 0.5;

      const avgRelX = (leftRelX + rightRelX) / 2;
      const avgRelY = (leftCenter.y + rightCenter.y) / 2;

      // Calculate confidence based on eye visibility
      const eyeWidthRatio = Math.min(leftEyeWidth, rightEyeWidth) / Math.max(leftEyeWidth, rightEyeWidth);
      const confidence = Math.min(eyeWidthRatio, 0.95);

      const screenX = avgRelX * window.innerWidth + calibrationOffsetRef.current.x;
      const screenY = avgRelY * window.innerHeight + calibrationOffsetRef.current.y;

      return { x: screenX, y: screenY, confidence };
    } catch {
      return null;
    }
  }, []);

  const processLandmarks = useCallback((landmarks: any[]) => {
    const result = calculateGazeFromIris(landmarks);
    if (!result) return;

    const { x: rawX, y: rawY, confidence } = result;
    const timestamp = Date.now();

    updateFps();

    // Update debug info
    setDebugInfo(prev => ({
      ...prev,
      landmarkCount: landmarks.length,
      gazeX: rawX,
      gazeY: rawY,
      confidence,
      isProcessing: true
    }));

    // Apply smoothing
    gazeBufferRef.current.push({ x: rawX, y: rawY });
    if (gazeBufferRef.current.length > SMOOTHING_WINDOW) {
      gazeBufferRef.current.shift();
    }

    const bufferLength = gazeBufferRef.current.length;
    if (bufferLength === 0) return;

    const smoothedX = gazeBufferRef.current.reduce((sum, p) => sum + p.x, 0) / bufferLength;
    const smoothedY = gazeBufferRef.current.reduce((sum, p) => sum + p.y, 0) / bufferLength;

    const point: GazePoint = { x: smoothedX, y: smoothedY, timestamp };

    setCurrentGaze({ x: smoothedX, y: smoothedY });
    setGazeData(prev => [...prev.slice(-500), point]);

    // Detect fixations
    const lastGaze = lastGazeRef.current;
    if (lastGaze) {
      const distance = Math.sqrt(
        Math.pow(smoothedX - lastGaze.x, 2) + Math.pow(smoothedY - lastGaze.y, 2)
      );

      if (distance < FIXATION_THRESHOLD) {
        if (!fixationStartRef.current) {
          fixationStartRef.current = { x: smoothedX, y: smoothedY, timestamp };
        }
      } else {
        const fixationStart = fixationStartRef.current;
        if (fixationStart) {
          const duration = timestamp - fixationStart.timestamp;
          if (duration >= FIXATION_MIN_DURATION) {
            setFixations(prev => [...prev, {
              x: fixationStart.x,
              y: fixationStart.y,
              duration,
              timestamp: fixationStart.timestamp
            }]);
          }

          const isRegression = smoothedX < lastGaze.x;
          setSaccades(prev => [...prev, {
            startX: lastGaze.x,
            startY: lastGaze.y,
            endX: smoothedX,
            endY: smoothedY,
            duration: timestamp - lastGaze.timestamp,
            isRegression
          }]);
        }
        fixationStartRef.current = null;
      }
    }

    lastGazeRef.current = point;
  }, [calculateGazeFromIris, updateFps]);

  // Process WebGazer gaze data
  const processWebGazerGaze = useCallback((x: number, y: number) => {
    const timestamp = Date.now();

    updateFps();

    setDebugInfo(prev => ({
      ...prev,
      landmarkCount: 0, // WebGazer doesn't provide landmarks
      gazeX: x,
      gazeY: y,
      confidence: 0.6, // Lower confidence for WebGazer
      isProcessing: true
    }));

    // Apply smoothing
    gazeBufferRef.current.push({ x, y });
    if (gazeBufferRef.current.length > SMOOTHING_WINDOW) {
      gazeBufferRef.current.shift();
    }

    const bufferLength = gazeBufferRef.current.length;
    if (bufferLength === 0) return;

    const smoothedX = gazeBufferRef.current.reduce((sum, p) => sum + p.x, 0) / bufferLength;
    const smoothedY = gazeBufferRef.current.reduce((sum, p) => sum + p.y, 0) / bufferLength;

    const point: GazePoint = { x: smoothedX, y: smoothedY, timestamp };

    setCurrentGaze({ x: smoothedX, y: smoothedY });
    setGazeData(prev => [...prev.slice(-500), point]);

    // Same fixation/saccade detection
    const lastGaze = lastGazeRef.current;
    if (lastGaze) {
      const distance = Math.sqrt(
        Math.pow(smoothedX - lastGaze.x, 2) + Math.pow(smoothedY - lastGaze.y, 2)
      );

      if (distance < FIXATION_THRESHOLD) {
        if (!fixationStartRef.current) {
          fixationStartRef.current = { x: smoothedX, y: smoothedY, timestamp };
        }
      } else {
        const fixationStart = fixationStartRef.current;
        if (fixationStart) {
          const duration = timestamp - fixationStart.timestamp;
          if (duration >= FIXATION_MIN_DURATION) {
            setFixations(prev => [...prev, {
              x: fixationStart.x,
              y: fixationStart.y,
              duration,
              timestamp: fixationStart.timestamp
            }]);
          }

          const isRegression = smoothedX < lastGaze.x;
          setSaccades(prev => [...prev, {
            startX: lastGaze.x,
            startY: lastGaze.y,
            endX: smoothedX,
            endY: smoothedY,
            duration: timestamp - lastGaze.timestamp,
            isRegression
          }]);
        }
        fixationStartRef.current = null;
      }
    }

    lastGazeRef.current = point;
  }, [updateFps]);

  // Initialize MediaPipe FaceMesh
  const initializeMediaPipe = useCallback(async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      await video.play();
      videoRef.current = video;

      const FaceMeshModule = await import('@mediapipe/face_mesh');
      const FaceMesh = FaceMeshModule.FaceMesh;

      const faceMesh = new FaceMesh({
        locateFile: (file: string) => `${MEDIAPIPE_CDN}/${file}`
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      faceMesh.onResults((results: { multiFaceLandmarks?: unknown[][] }) => {
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          processLandmarks(results.multiFaceLandmarks[0] as any[]);
        }
      });

      faceMeshRef.current = faceMesh;
      return true;
    } catch (error) {
      console.warn('MediaPipe initialization failed:', error);
      throw error;
    }
  }, [processLandmarks]);

  // Initialize WebGazer as fallback
  const initializeWebGazer = useCallback(async (): Promise<boolean> => {
    try {
      const webgazer = (await import('webgazer')).default;

      // Configure WebGazer
      webgazer.setRegression('ridge');
      webgazer.showVideo(false);
      webgazer.showFaceOverlay(false);
      webgazer.showFaceFeedbackBox(false);
      webgazer.showPredictionPoints(false);

      // Set gaze listener
      webgazer.setGazeListener((data: { x: number; y: number } | null) => {
        if (data && data.x !== null && data.y !== null) {
          processWebGazerGaze(data.x, data.y);
        }
      });

      await webgazer.begin();
      webgazerRef.current = webgazer;
      return true;
    } catch (error) {
      console.warn('WebGazer initialization failed:', error);
      throw error;
    }
  }, [processWebGazerGaze]);

  // Main initialize function with fallback
  const initialize = useCallback(async () => {
    if (faceMeshRef.current || webgazerRef.current) return true;

    initStartTimeRef.current = Date.now();

    // Try MediaPipe first
    try {
      console.log('Attempting MediaPipe FaceMesh initialization...');
      const success = await initializeMediaPipe();
      if (success) {
        const initTime = Date.now() - initStartTimeRef.current;
        setActiveBackend('mediapipe');
        setDebugInfo(prev => ({
          ...prev,
          backend: 'mediapipe',
          initializationTime: initTime
        }));
        setIsInitialized(true);
        setInitError(null);
        console.log('MediaPipe initialized successfully in', initTime, 'ms');
        return true;
      }
    } catch (error) {
      console.warn('MediaPipe failed, falling back to WebGazer:', error);
    }

    // Fallback to WebGazer
    try {
      console.log('Attempting WebGazer initialization...');
      const success = await initializeWebGazer();
      if (success) {
        const initTime = Date.now() - initStartTimeRef.current;
        setActiveBackend('webgazer');
        setDebugInfo(prev => ({
          ...prev,
          backend: 'webgazer',
          initializationTime: initTime,
          errorMessage: 'Using WebGazer fallback (lower precision)'
        }));
        setIsInitialized(true);
        setInitError('Using WebGazer fallback (lower precision)');
        console.log('WebGazer initialized successfully in', initTime, 'ms');
        return true;
      }
    } catch (error) {
      console.error('WebGazer also failed:', error);
      const message = 'Both MediaPipe and WebGazer initialization failed';
      setInitError(message);
      setDebugInfo(prev => ({
        ...prev,
        backend: 'none',
        errorMessage: message
      }));
    }

    setActiveBackend('none');
    setIsSupported(false);
    return false;
  }, [initializeMediaPipe, initializeWebGazer]);

  const startTracking = useCallback(async () => {
    if (!faceMeshRef.current && !webgazerRef.current) {
      const success = await initialize();
      if (!success) return;
    }

    setIsTracking(true);

    // Only need frame loop for MediaPipe
    if (faceMeshRef.current && videoRef.current) {
      const processFrame = async () => {
        if (!faceMeshRef.current || !videoRef.current) return;

        if (videoRef.current.readyState >= 2) {
          await faceMeshRef.current.send({ image: videoRef.current });
        }

        animationFrameRef.current = requestAnimationFrame(processFrame);
      };

      processFrame();
    }
    // WebGazer handles its own frame loop internally
  }, [initialize]);

  const stop = useCallback(() => {
    setIsTracking(false);
    setDebugInfo(prev => ({ ...prev, isProcessing: false }));
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Pause WebGazer if active
    if (webgazerRef.current) {
      webgazerRef.current.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (isInitialized) {
      if (webgazerRef.current) {
        webgazerRef.current.resume();
      }
      startTracking();
    }
  }, [isInitialized, startTracking]);

  const reset = useCallback(() => {
    setGazeData([]);
    setFixations([]);
    setSaccades([]);
    lastGazeRef.current = null;
    fixationStartRef.current = null;
    gazeBufferRef.current = [];
  }, []);

  const applyCalibrationOffset = useCallback((offsetX: number, offsetY: number) => {
    calibrationOffsetRef.current = { x: offsetX, y: offsetY };
    setIsCalibrated(true);
  }, []);

  const getMetrics = useCallback((): EyeTrackingMetrics => {
    const prolongedFixations = fixations.filter(f => f.duration > 400).length;
    const regressionCount = saccades.filter(s => s.isRegression).length;
    const avgFixationDuration = fixations.length > 0
      ? fixations.reduce((sum, f) => sum + f.duration, 0) / fixations.length
      : 0;

    let intersections = 0;
    for (let i = 0; i < saccades.length - 1; i++) {
      for (let j = i + 1; j < saccades.length; j++) {
        const s1 = saccades[i];
        const s2 = saccades[j];
        const dx1 = s1.endX - s1.startX;
        const dy1 = s1.endY - s1.startY;
        const dx2 = s2.endX - s2.startX;
        const dy2 = s2.endY - s2.startY;
        const cross = dx1 * dy2 - dy1 * dx2;
        if (Math.abs(cross) > 0.001) intersections++;
      }
    }

    const fic = saccades.length > 1 ? intersections / (saccades.length * (saccades.length - 1) / 2) : 0;

    let chaosIndex = 0;
    if (gazeData.length > 2) {
      let totalVariance = 0;
      for (let i = 2; i < gazeData.length; i++) {
        const angle1 = Math.atan2(
          gazeData[i - 1].y - gazeData[i - 2].y,
          gazeData[i - 1].x - gazeData[i - 2].x
        );
        const angle2 = Math.atan2(
          gazeData[i].y - gazeData[i - 1].y,
          gazeData[i].x - gazeData[i - 1].x
        );
        totalVariance += Math.abs(angle2 - angle1);
      }
      chaosIndex = totalVariance / (gazeData.length - 2);
    }

    return {
      totalFixations: fixations.length,
      averageFixationDuration: avgFixationDuration,
      regressionCount,
      prolongedFixations,
      chaosIndex: Math.min(chaosIndex, 1),
      fixationIntersectionCoefficient: Math.min(fic, 1)
    };
  }, [fixations, saccades, gazeData]);

  useEffect(() => {
    return () => {
      stop();
      if (faceMeshRef.current) {
        faceMeshRef.current.close?.();
      }
      if (webgazerRef.current) {
        webgazerRef.current.end?.();
      }
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [stop]);

  return {
    isInitialized,
    isTracking,
    isCalibrated,
    isSupported,
    initError,
    gazeData,
    fixations,
    saccades,
    currentGaze,
    activeBackend,
    debugInfo,
    initialize,
    startTracking,
    stop,
    resume,
    reset,
    getMetrics,
    setIsCalibrated,
    applyCalibrationOffset
  };
}