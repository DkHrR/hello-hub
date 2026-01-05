import { useState, useEffect, useCallback, useRef } from 'react';
import type { GazePoint, Fixation, Saccade, EyeTrackingMetrics } from '@/types/diagnostic';

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

  const faceMeshRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastGazeRef = useRef<GazePoint | null>(null);
  const fixationStartRef = useRef<{ x: number; y: number; timestamp: number } | null>(null);
  const gazeBufferRef = useRef<{ x: number; y: number }[]>([]);
  const calibrationOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const FIXATION_THRESHOLD = 30; // pixels - tighter threshold for MediaPipe
  const FIXATION_MIN_DURATION = 100; // ms
  const SMOOTHING_WINDOW = 5;

  // Calculate gaze position from iris landmarks
  const calculateGazeFromIris = useCallback((landmarks: any[]): { x: number; y: number } | null => {
    if (!landmarks || landmarks.length < 478) return null;

    try {
      // Get iris centers
      const leftIrisPoints = LEFT_IRIS_INDICES.map(i => landmarks[i]).filter(Boolean);
      const rightIrisPoints = RIGHT_IRIS_INDICES.map(i => landmarks[i]).filter(Boolean);

      if (leftIrisPoints.length < 4 || rightIrisPoints.length < 4) return null;

      // Calculate iris centers
      const leftCenter = {
        x: leftIrisPoints.reduce((sum, p) => sum + p.x, 0) / leftIrisPoints.length,
        y: leftIrisPoints.reduce((sum, p) => sum + p.y, 0) / leftIrisPoints.length
      };

      const rightCenter = {
        x: rightIrisPoints.reduce((sum, p) => sum + p.x, 0) / rightIrisPoints.length,
        y: rightIrisPoints.reduce((sum, p) => sum + p.y, 0) / rightIrisPoints.length
      };

      // Get eye corners for relative position
      const leftEyeOuter = landmarks[LEFT_EYE_INDICES[0]];
      const leftEyeInner = landmarks[LEFT_EYE_INDICES[1]];
      const rightEyeOuter = landmarks[RIGHT_EYE_INDICES[0]];
      const rightEyeInner = landmarks[RIGHT_EYE_INDICES[1]];

      if (!leftEyeOuter || !leftEyeInner || !rightEyeOuter || !rightEyeInner) return null;

      // Calculate relative iris position within each eye (0-1 range)
      const leftEyeWidth = Math.abs(leftEyeInner.x - leftEyeOuter.x);
      const rightEyeWidth = Math.abs(rightEyeInner.x - rightEyeOuter.x);

      const leftRelX = leftEyeWidth > 0 ? (leftCenter.x - leftEyeOuter.x) / leftEyeWidth : 0.5;
      const rightRelX = rightEyeWidth > 0 ? (rightCenter.x - rightEyeOuter.x) / rightEyeWidth : 0.5;

      // Average the relative positions
      const avgRelX = (leftRelX + rightRelX) / 2;
      const avgRelY = (leftCenter.y + rightCenter.y) / 2;

      // Map to screen coordinates (with calibration offset)
      const screenX = avgRelX * window.innerWidth + calibrationOffsetRef.current.x;
      const screenY = avgRelY * window.innerHeight + calibrationOffsetRef.current.y;

      return { x: screenX, y: screenY };
    } catch {
      return null;
    }
  }, []);

  const processLandmarks = useCallback((landmarks: any[]) => {
    const rawGaze = calculateGazeFromIris(landmarks);
    if (!rawGaze) return;

    const timestamp = Date.now();

    // Apply smoothing
    gazeBufferRef.current.push(rawGaze);
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

          // Detect saccade
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
  }, [calculateGazeFromIris]);

  const initialize = useCallback(async () => {
    if (faceMeshRef.current) return true;

    try {
      // Check for camera support
      if (!navigator.mediaDevices?.getUserMedia) {
        setIsSupported(false);
        setInitError('Camera not supported in this browser');
        return false;
      }

      // Get video stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      await video.play();
      videoRef.current = video;

      // Initialize MediaPipe Face Mesh with CDN
      const FaceMeshModule = await import('@mediapipe/face_mesh');
      const FaceMesh = FaceMeshModule.FaceMesh;

      const faceMesh = new FaceMesh({
        locateFile: (file: string) => `${MEDIAPIPE_CDN}/${file}`
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true, // Enable iris tracking
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      faceMesh.onResults((results: { multiFaceLandmarks?: unknown[][] }) => {
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          processLandmarks(results.multiFaceLandmarks[0] as any[]);
        }
      });

      faceMeshRef.current = faceMesh;
      setIsInitialized(true);
      setInitError(null);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize eye tracking';
      setInitError(message);
      setIsSupported(false);
      return false;
    }
  }, [processLandmarks]);

  const startTracking = useCallback(async () => {
    if (!faceMeshRef.current || !videoRef.current) {
      const success = await initialize();
      if (!success) return;
    }

    setIsTracking(true);

    const processFrame = async () => {
      if (!faceMeshRef.current || !videoRef.current) return;

      if (videoRef.current.readyState >= 2) {
        await faceMeshRef.current.send({ image: videoRef.current });
      }

      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    processFrame();
  }, [initialize]);

  const stop = useCallback(() => {
    setIsTracking(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    if (isInitialized) {
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

  // Calibration adjustment
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

    // Calculate Fixation Intersection Coefficient (FIC)
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

    // Chaos index based on gaze path variability
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
