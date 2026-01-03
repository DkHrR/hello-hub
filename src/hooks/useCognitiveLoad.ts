import { useState, useCallback, useRef, useEffect } from 'react';
import { useFaceMeshPupilTracking } from './useFaceMeshPupilTracking';
import type { CognitiveLoadMetrics } from '@/types/diagnostic';

interface PupilMeasurement {
  timestamp: number;
  leftPupilSize: number;
  rightPupilSize: number;
  averageSize: number;
}

export function useCognitiveLoad() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentLoad, setCurrentLoad] = useState<'low' | 'moderate' | 'high'>('low');
  const [localMeasurements, setLocalMeasurements] = useState<PupilMeasurement[]>([]);
  const [localOverloadEvents, setLocalOverloadEvents] = useState<{ timestamp: number; duration: number }[]>([]);
  
  const baselinePupilSizeRef = useRef<number | null>(null);
  const overloadStartRef = useRef<number | null>(null);
  
  // Use real face-mesh pupil tracking
  const faceMesh = useFaceMeshPupilTracking();
  
  // Thresholds for cognitive load detection based on ETDD70 standards
  const DILATION_MODERATE_THRESHOLD = 1.15; // 15% increase from baseline
  const DILATION_HIGH_THRESHOLD = 1.30; // 30% increase from baseline
  const OVERLOAD_DURATION_THRESHOLD = 3000; // 3 seconds of high load = overload event

  // Start monitoring - now uses real face-mesh data
  const startMonitoring = useCallback(async () => {
    setIsMonitoring(true);
    setLocalMeasurements([]);
    setLocalOverloadEvents([]);
    baselinePupilSizeRef.current = null;
    overloadStartRef.current = null;
    
    // Start real face-mesh tracking (uses startMonitoring from the hook)
    await faceMesh.startMonitoring();
  }, [faceMesh]);

  // Process real pupil data from face-mesh measurements
  useEffect(() => {
    if (!isMonitoring || faceMesh.measurements.length === 0) return;
    
    const latestMeasurement = faceMesh.measurements[faceMesh.measurements.length - 1];
    if (!latestMeasurement) return;
    
    const measurement: PupilMeasurement = {
      timestamp: latestMeasurement.timestamp,
      leftPupilSize: latestMeasurement.leftPupilSize,
      rightPupilSize: latestMeasurement.rightPupilSize,
      averageSize: latestMeasurement.averageSize
    };
    
    setLocalMeasurements(prev => {
      const updated = [...prev.slice(-300), measurement];
      
      // Establish baseline from first 30 measurements (3 seconds at 100ms intervals)
      if (!baselinePupilSizeRef.current && updated.length >= 30) {
        const recent = updated.slice(0, 30);
        baselinePupilSizeRef.current = recent.reduce((sum, m) => sum + m.averageSize, 0) / 30;
      }
      
      return updated;
    });
    
    // Detect cognitive load level
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
            setLocalOverloadEvents(prev => {
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
  }, [isMonitoring, faceMesh.measurements]);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    faceMesh.stopMonitoring();
  }, [faceMesh]);

  const getMetrics = useCallback((): CognitiveLoadMetrics => {
    if (localMeasurements.length === 0) {
      return {
        averagePupilDilation: 0,
        overloadEvents: 0,
        stressIndicators: 0
      };
    }

    const baseline = baselinePupilSizeRef.current || localMeasurements[0].averageSize;
    
    // Calculate average dilation ratio
    const dilationRatios = localMeasurements.map(m => m.averageSize / baseline);
    const avgDilation = dilationRatios.reduce((a, b) => a + b, 0) / dilationRatios.length;
    
    // Count stress indicators (rapid changes in pupil size)
    let stressIndicators = 0;
    for (let i = 1; i < localMeasurements.length; i++) {
      const change = Math.abs(localMeasurements[i].averageSize - localMeasurements[i-1].averageSize);
      if (change > 0.5) {
        stressIndicators++;
      }
    }
    
    return {
      averagePupilDilation: (avgDilation - 1) * 100,
      overloadEvents: localOverloadEvents.length,
      stressIndicators
    };
  }, [localMeasurements, localOverloadEvents]);

  const reset = useCallback(() => {
    stopMonitoring();
    setLocalMeasurements([]);
    setLocalOverloadEvents([]);
    setCurrentLoad('low');
    baselinePupilSizeRef.current = null;
    faceMesh.reset();
  }, [stopMonitoring, faceMesh]);

  return {
    isMonitoring,
    currentLoad,
    measurements: localMeasurements,
    overloadEvents: localOverloadEvents,
    baselinePupilSize: baselinePupilSizeRef.current,
    // Face-mesh specific data
    isFaceMeshReady: faceMesh.isInitialized,
    faceMeshError: null,
    // Actions
    startMonitoring,
    stopMonitoring,
    getMetrics,
    reset
  };
}
