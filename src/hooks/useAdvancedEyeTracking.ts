import { useState, useRef, useCallback, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

export interface GazePoint {
  x: number;
  y: number;
  timestamp: number;
  confidence: number;
}

export interface EyeMetrics {
  leftEyeCenter: { x: number; y: number };
  rightEyeCenter: { x: number; y: number };
  leftIrisCenter: { x: number; y: number };
  rightIrisCenter: { x: number; y: number };
  gazeDirection: { x: number; y: number; z: number };
  blinkDetected: boolean;
  headPose: { pitch: number; yaw: number; roll: number };
}

export interface AdvancedTrackingState {
  isInitialized: boolean;
  isTracking: boolean;
  isCalibrated: boolean;
  currentGaze: GazePoint | null;
  gazeHistory: GazePoint[];
  eyeMetrics: EyeMetrics | null;
  fixations: Array<{ x: number; y: number; duration: number; startTime: number }>;
  saccades: Array<{ startX: number; startY: number; endX: number; endY: number; velocity: number }>;
  blinkCount: number;
  attentionScore: number;
  fps: number;
  error: string | null;
}

// Iris landmark indices from MediaPipe Face Mesh (478 landmarks model)
const LEFT_IRIS_INDICES = [468, 469, 470, 471, 472];
const RIGHT_IRIS_INDICES = [473, 474, 475, 476, 477];
const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380];

// Calibration offsets
interface CalibrationData {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

export function useAdvancedEyeTracking() {
  const [state, setState] = useState<AdvancedTrackingState>({
    isInitialized: false,
    isTracking: false,
    isCalibrated: false,
    currentGaze: null,
    gazeHistory: [],
    eyeMetrics: null,
    fixations: [],
    saccades: [],
    blinkCount: 0,
    attentionScore: 100,
    fps: 0,
    error: null,
  });

  const detectorRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const calibrationRef = useRef<CalibrationData>({ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 });
  const lastFrameTimeRef = useRef<number>(0);
  const fpsCounterRef = useRef<number[]>([]);
  const lastGazeRef = useRef<GazePoint | null>(null);
  const fixationStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const blinkStateRef = useRef<boolean>(false);

  const FIXATION_THRESHOLD = 30; // pixels
  const FIXATION_MIN_DURATION = 100; // ms
  const SACCADE_VELOCITY_THRESHOLD = 100; // pixels/second

  const initialize = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));

      // Set TensorFlow.js backend
      await tf.setBackend('webgl');
      await tf.ready();

      // Create detector with MediaPipe Face Mesh model (478 landmarks including iris)
      const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
      const detectorConfig: faceLandmarksDetection.MediaPipeFaceMeshTfjsModelConfig = {
        runtime: 'tfjs',
        refineLandmarks: true, // Enables iris tracking (478 landmarks)
        maxFaces: 1,
      };

      const detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
      detectorRef.current = detector;

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30 },
        },
      });

      streamRef.current = stream;

      // Create video element
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });

      videoRef.current = video;

      setState(prev => ({ ...prev, isInitialized: true }));
      console.log('[AdvancedEyeTracking] Initialized with TensorFlow.js Face Landmarks Detection');
    } catch (error) {
      console.error('[AdvancedEyeTracking] Initialization error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to initialize eye tracking' 
      }));
    }
  }, []);

  const calculateGazeFromLandmarks = useCallback((
    keypoints: faceLandmarksDetection.Keypoint[]
  ): { gaze: GazePoint; metrics: EyeMetrics } | null => {
    if (keypoints.length < 478) return null;

    // Get iris centers
    const getCenter = (indices: number[]) => {
      const points = indices.map(i => keypoints[i]);
      const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
      const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
      return { x, y };
    };

    const leftIris = getCenter(LEFT_IRIS_INDICES);
    const rightIris = getCenter(RIGHT_IRIS_INDICES);
    const leftEye = getCenter(LEFT_EYE_INDICES);
    const rightEye = getCenter(RIGHT_EYE_INDICES);

    // Calculate eye aspect ratio for blink detection
    const getEAR = (eyeIndices: number[]) => {
      const pts = eyeIndices.map(i => keypoints[i]);
      const vertical1 = Math.hypot(pts[1].x - pts[5].x, pts[1].y - pts[5].y);
      const vertical2 = Math.hypot(pts[2].x - pts[4].x, pts[2].y - pts[4].y);
      const horizontal = Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y);
      return (vertical1 + vertical2) / (2 * horizontal);
    };

    const leftEAR = getEAR(LEFT_EYE_INDICES);
    const rightEAR = getEAR(RIGHT_EYE_INDICES);
    const avgEAR = (leftEAR + rightEAR) / 2;
    const blinkDetected = avgEAR < 0.2;

    // Calculate gaze direction from iris position relative to eye center
    const leftGazeX = (leftIris.x - leftEye.x) / (keypoints[33].x - keypoints[133].x);
    const leftGazeY = (leftIris.y - leftEye.y) / (keypoints[159].y - keypoints[145].y);
    const rightGazeX = (rightIris.x - rightEye.x) / (keypoints[362].x - keypoints[263].x);
    const rightGazeY = (rightIris.y - rightEye.y) / (keypoints[386].y - keypoints[374].y);

    // Average gaze direction
    const gazeX = (leftGazeX + rightGazeX) / 2;
    const gazeY = (leftGazeY + rightGazeY) / 2;

    // Map to screen coordinates
    const cal = calibrationRef.current;
    const screenX = (0.5 + gazeX * cal.scaleX + cal.offsetX) * window.innerWidth;
    const screenY = (0.5 + gazeY * cal.scaleY + cal.offsetY) * window.innerHeight;

    // Estimate head pose from nose and eye positions
    const nose = keypoints[1];
    const foreheadCenter = keypoints[10];
    const yaw = Math.atan2(leftEye.x - rightEye.x, 200) * 180 / Math.PI;
    const pitch = Math.atan2(nose.y - foreheadCenter.y, 200) * 180 / Math.PI;
    const roll = Math.atan2(leftEye.y - rightEye.y, leftEye.x - rightEye.x) * 180 / Math.PI;

    const gaze: GazePoint = {
      x: Math.max(0, Math.min(window.innerWidth, screenX)),
      y: Math.max(0, Math.min(window.innerHeight, screenY)),
      timestamp: Date.now(),
      confidence: 0.8,
    };

    const metrics: EyeMetrics = {
      leftEyeCenter: leftEye,
      rightEyeCenter: rightEye,
      leftIrisCenter: leftIris,
      rightIrisCenter: rightIris,
      gazeDirection: { x: gazeX, y: gazeY, z: 0 },
      blinkDetected,
      headPose: { pitch, yaw, roll },
    };

    return { gaze, metrics };
  }, []);

  const processFrame = useCallback(async () => {
    if (!state.isTracking || !detectorRef.current || !videoRef.current) return;

    const now = performance.now();
    
    try {
      const faces = await detectorRef.current.estimateFaces(videoRef.current);

      if (faces.length > 0 && faces[0].keypoints) {
        const result = calculateGazeFromLandmarks(faces[0].keypoints);
        
        if (result) {
          const { gaze, metrics } = result;

          // Detect blinks
          if (metrics.blinkDetected && !blinkStateRef.current) {
            blinkStateRef.current = true;
            setState(prev => ({ ...prev, blinkCount: prev.blinkCount + 1 }));
          } else if (!metrics.blinkDetected) {
            blinkStateRef.current = false;
          }

          // Detect fixations and saccades
          const lastGaze = lastGazeRef.current;
          if (lastGaze) {
            const distance = Math.hypot(gaze.x - lastGaze.x, gaze.y - lastGaze.y);
            const timeDelta = (gaze.timestamp - lastGaze.timestamp) / 1000;
            const velocity = distance / timeDelta;

            if (velocity < SACCADE_VELOCITY_THRESHOLD) {
              // Potential fixation
              if (!fixationStartRef.current) {
                fixationStartRef.current = { x: gaze.x, y: gaze.y, time: gaze.timestamp };
              } else {
                const fixDist = Math.hypot(
                  gaze.x - fixationStartRef.current.x,
                  gaze.y - fixationStartRef.current.y
                );
                
                if (fixDist > FIXATION_THRESHOLD) {
                  // End current fixation if moved too far
                  const duration = gaze.timestamp - fixationStartRef.current.time;
                  if (duration >= FIXATION_MIN_DURATION) {
                    setState(prev => ({
                      ...prev,
                      fixations: [...prev.fixations.slice(-99), {
                        x: fixationStartRef.current!.x,
                        y: fixationStartRef.current!.y,
                        duration,
                        startTime: fixationStartRef.current!.time,
                      }],
                    }));
                  }
                  fixationStartRef.current = { x: gaze.x, y: gaze.y, time: gaze.timestamp };
                }
              }
            } else {
              // Saccade detected
              if (fixationStartRef.current) {
                const duration = gaze.timestamp - fixationStartRef.current.time;
                if (duration >= FIXATION_MIN_DURATION) {
                  setState(prev => ({
                    ...prev,
                    fixations: [...prev.fixations.slice(-99), {
                      x: fixationStartRef.current!.x,
                      y: fixationStartRef.current!.y,
                      duration,
                      startTime: fixationStartRef.current!.time,
                    }],
                  }));
                }
                fixationStartRef.current = null;
              }

              setState(prev => ({
                ...prev,
                saccades: [...prev.saccades.slice(-99), {
                  startX: lastGaze.x,
                  startY: lastGaze.y,
                  endX: gaze.x,
                  endY: gaze.y,
                  velocity,
                }],
              }));
            }
          }

          lastGazeRef.current = gaze;

          // Calculate FPS
          fpsCounterRef.current.push(now);
          fpsCounterRef.current = fpsCounterRef.current.filter(t => now - t < 1000);
          const fps = fpsCounterRef.current.length;

          setState(prev => ({
            ...prev,
            currentGaze: gaze,
            gazeHistory: [...prev.gazeHistory.slice(-299), gaze],
            eyeMetrics: metrics,
            fps,
          }));
        }
      }
    } catch (error) {
      console.error('[AdvancedEyeTracking] Frame processing error:', error);
    }

    lastFrameTimeRef.current = now;
    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, [state.isTracking, calculateGazeFromLandmarks]);

  const startTracking = useCallback(() => {
    if (!state.isInitialized) {
      console.warn('[AdvancedEyeTracking] Not initialized');
      return;
    }

    setState(prev => ({ ...prev, isTracking: true }));
    animationFrameRef.current = requestAnimationFrame(processFrame);
    console.log('[AdvancedEyeTracking] Tracking started');
  }, [state.isInitialized, processFrame]);

  const stopTracking = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setState(prev => ({ ...prev, isTracking: false }));
    console.log('[AdvancedEyeTracking] Tracking stopped');
  }, []);

  const calibrate = useCallback((points: Array<{ screenX: number; screenY: number; gazeX: number; gazeY: number }>) => {
    if (points.length < 3) return;

    // Simple linear calibration
    const avgOffsetX = points.reduce((sum, p) => sum + (p.screenX / window.innerWidth - 0.5 - p.gazeX), 0) / points.length;
    const avgOffsetY = points.reduce((sum, p) => sum + (p.screenY / window.innerHeight - 0.5 - p.gazeY), 0) / points.length;

    calibrationRef.current = {
      offsetX: avgOffsetX,
      offsetY: avgOffsetY,
      scaleX: 1.5,
      scaleY: 1.5,
    };

    setState(prev => ({ ...prev, isCalibrated: true }));
    console.log('[AdvancedEyeTracking] Calibration applied:', calibrationRef.current);
  }, []);

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      gazeHistory: [],
      fixations: [],
      saccades: [],
      blinkCount: 0,
      attentionScore: 100,
    }));
    lastGazeRef.current = null;
    fixationStartRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    stopTracking();
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (detectorRef.current) {
      detectorRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current = null;
    }

    setState({
      isInitialized: false,
      isTracking: false,
      isCalibrated: false,
      currentGaze: null,
      gazeHistory: [],
      eyeMetrics: null,
      fixations: [],
      saccades: [],
      blinkCount: 0,
      attentionScore: 100,
      fps: 0,
      error: null,
    });
  }, [stopTracking]);

  const getMetrics = useCallback(() => {
    const { fixations, saccades, gazeHistory, blinkCount } = state;
    
    const avgFixationDuration = fixations.length > 0
      ? fixations.reduce((sum, f) => sum + f.duration, 0) / fixations.length
      : 0;

    const regressionCount = saccades.filter(s => s.endX < s.startX).length;
    
    const prolongedFixations = fixations.filter(f => f.duration > 500).length;
    
    // Calculate gaze path chaos (variability)
    let chaosIndex = 0;
    if (gazeHistory.length > 10) {
      const recent = gazeHistory.slice(-100);
      const distances: number[] = [];
      for (let i = 1; i < recent.length; i++) {
        distances.push(Math.hypot(recent[i].x - recent[i-1].x, recent[i].y - recent[i-1].y));
      }
      const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
      const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDist, 2), 0) / distances.length;
      chaosIndex = Math.sqrt(variance) / 100;
    }

    return {
      avgFixationDuration,
      regressionCount,
      prolongedFixations,
      totalFixations: fixations.length,
      totalSaccades: saccades.length,
      blinkCount,
      chaosIndex,
      gazePointCount: gazeHistory.length,
    };
  }, [state]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return {
    ...state,
    initialize,
    startTracking,
    stopTracking,
    calibrate,
    reset,
    cleanup,
    getMetrics,
    videoElement: videoRef.current,
  };
}
