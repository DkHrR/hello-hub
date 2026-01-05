import { useState, useEffect, useCallback, useRef } from 'react';
import type { GazePoint, Fixation, Saccade, EyeTrackingMetrics } from '@/types/diagnostic';
import webgazer from 'webgazer';

export function useEyeTracking() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [gazeData, setGazeData] = useState<GazePoint[]>([]);
  const [fixations, setFixations] = useState<Fixation[]>([]);
  const [saccades, setSaccades] = useState<Saccade[]>([]);
  const [currentGaze, setCurrentGaze] = useState<{ x: number; y: number } | null>(null);
  
  const lastGazeRef = useRef<GazePoint | null>(null);
  const fixationStartRef = useRef<{ x: number; y: number; timestamp: number } | null>(null);
  const webgazerInitializedRef = useRef(false);
  const gazeBufferRef = useRef<{ x: number; y: number }[]>([]); // 5-frame moving average buffer

  const FIXATION_THRESHOLD = 50; // pixels
  const FIXATION_MIN_DURATION = 100; // ms
  const SMOOTHING_WINDOW = 5; // frames for moving average

  const initialize = useCallback(async () => {
    if (webgazerInitializedRef.current) return;
    
    try {
      await webgazer
        .setGazeListener((data: { x: number; y: number } | null, timestamp: number) => {
          if (data && typeof data.x === 'number' && typeof data.y === 'number') {
            // Apply 5-frame moving average filter for gaze smoothing
            gazeBufferRef.current.push({ x: data.x, y: data.y });
            if (gazeBufferRef.current.length > SMOOTHING_WINDOW) {
              gazeBufferRef.current.shift();
            }
            
            const bufferLength = gazeBufferRef.current.length;
            if (bufferLength === 0) return;
            
            const smoothedX = gazeBufferRef.current.reduce((sum, p) => sum + p.x, 0) / bufferLength;
            const smoothedY = gazeBufferRef.current.reduce((sum, p) => sum + p.y, 0) / bufferLength;
            
            const point: GazePoint = {
              x: smoothedX,
              y: smoothedY,
              timestamp
            };
            
            setCurrentGaze({ x: smoothedX, y: smoothedY });
            setGazeData(prev => [...prev.slice(-500), point]);
              
              // Detect fixations
              const lastGaze = lastGazeRef.current;
              if (lastGaze && typeof lastGaze.x === 'number' && typeof lastGaze.y === 'number') {
                const distance = Math.sqrt(
                  Math.pow(data.x - lastGaze.x, 2) +
                  Math.pow(data.y - lastGaze.y, 2)
                );
                
                if (distance < FIXATION_THRESHOLD) {
                  if (!fixationStartRef.current) {
                    fixationStartRef.current = { x: data.x, y: data.y, timestamp };
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
                    const isRegression = data.x < lastGaze.x;
                    setSaccades(prev => [...prev, {
                      startX: lastGaze.x,
                      startY: lastGaze.y,
                      endX: data.x,
                      endY: data.y,
                      duration: timestamp - lastGaze.timestamp,
                      isRegression
                    }]);
                  }
                  fixationStartRef.current = null;
                }
              }
              
            lastGazeRef.current = point;
          }
        })
        .begin();
      
      webgazer.showVideoPreview(false);
      webgazer.showPredictionPoints(false);
      
      webgazerInitializedRef.current = true;
      setIsInitialized(true);
      setIsTracking(true);
    } catch {
      // Failed to initialize eye tracking - will fall back to manual input
    }
  }, []);

  const stop = useCallback(() => {
    if (webgazerInitializedRef.current) {
      webgazer.pause();
      setIsTracking(false);
    }
  }, []);

  const resume = useCallback(() => {
    if (webgazerInitializedRef.current && isInitialized) {
      webgazer.resume();
      setIsTracking(true);
    }
  }, [isInitialized]);

  const reset = useCallback(() => {
    setGazeData([]);
    setFixations([]);
    setSaccades([]);
    lastGazeRef.current = null;
    fixationStartRef.current = null;
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
        // Simplified intersection check
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
          gazeData[i-1].y - gazeData[i-2].y,
          gazeData[i-1].x - gazeData[i-2].x
        );
        const angle2 = Math.atan2(
          gazeData[i].y - gazeData[i-1].y,
          gazeData[i].x - gazeData[i-1].x
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
      if (webgazerInitializedRef.current) {
        webgazer.end();
        webgazerInitializedRef.current = false;
      }
    };
  }, []);

  return {
    isInitialized,
    isTracking,
    isCalibrated,
    setIsCalibrated,
    gazeData,
    fixations,
    saccades,
    currentGaze,
    initialize,
    stop,
    resume,
    reset,
    getMetrics
  };
}
