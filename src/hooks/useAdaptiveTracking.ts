import { useState, useEffect, useCallback } from 'react';
import { useDeviceDetection } from './useDeviceDetection';
import { useAdvancedEyeTracking } from './useAdvancedEyeTracking';
import { useUnifiedEyeTracking } from './useUnifiedEyeTracking';

type TrackingMethod = 'tensorflow' | 'mediapipe' | 'manual' | 'none';

interface AdaptiveTrackingState {
  activeMethod: TrackingMethod;
  isInitialized: boolean;
  isTracking: boolean;
  error: string | null;
  fallbackReason: string | null;
}

export function useAdaptiveTracking() {
  const device = useDeviceDetection();
  const advancedTracking = useAdvancedEyeTracking();
  const unifiedTracking = useUnifiedEyeTracking();

  const [state, setState] = useState<AdaptiveTrackingState>({
    activeMethod: 'none',
    isInitialized: false,
    isTracking: false,
    error: null,
    fallbackReason: null,
  });

  const selectBestMethod = useCallback((): TrackingMethod => {
    // On mobile or low-performance devices, use MediaPipe directly
    if (device.isMobile || !device.isHighPerformance) {
      return 'mediapipe';
    }

    // Desktop with good GPU: try TensorFlow.js first
    if (device.isDesktop && device.isHighPerformance) {
      return 'tensorflow';
    }

    // Tablet or medium devices
    return 'mediapipe';
  }, [device]);

  const initialize = useCallback(async () => {
    const method = selectBestMethod();
    setState(prev => ({ ...prev, error: null, fallbackReason: null }));

    if (method === 'tensorflow') {
      try {
        await advancedTracking.initialize();
        setState({
          activeMethod: 'tensorflow',
          isInitialized: true,
          isTracking: false,
          error: null,
          fallbackReason: null,
        });
        console.log('[AdaptiveTracking] Using TensorFlow.js eye tracking');
        return;
      } catch (error) {
        console.warn('[AdaptiveTracking] TensorFlow.js failed, falling back to MediaPipe');
        setState(prev => ({ 
          ...prev, 
          fallbackReason: 'TensorFlow.js initialization failed, using MediaPipe' 
        }));
      }
    }

    // Fallback to MediaPipe
    try {
      await unifiedTracking.initialize();
      setState({
        activeMethod: 'mediapipe',
        isInitialized: true,
        isTracking: false,
        error: null,
        fallbackReason: method === 'tensorflow' ? 'Fallback from TensorFlow.js' : null,
      });
      console.log('[AdaptiveTracking] Using MediaPipe eye tracking');
    } catch (error) {
      console.warn('[AdaptiveTracking] MediaPipe failed, no eye tracking available');
      setState({
        activeMethod: 'manual',
        isInitialized: false,
        isTracking: false,
        error: 'Eye tracking not available on this device',
        fallbackReason: 'All tracking methods failed',
      });
    }
  }, [selectBestMethod, advancedTracking, unifiedTracking]);

  const startTracking = useCallback(() => {
    if (state.activeMethod === 'tensorflow') {
      advancedTracking.startTracking();
    } else if (state.activeMethod === 'mediapipe') {
      unifiedTracking.startTracking();
    }
    setState(prev => ({ ...prev, isTracking: true }));
  }, [state.activeMethod, advancedTracking, unifiedTracking]);

  const stopTracking = useCallback(() => {
    if (state.activeMethod === 'tensorflow') {
      advancedTracking.stopTracking();
    } else if (state.activeMethod === 'mediapipe') {
      unifiedTracking.stop();
    }
    setState(prev => ({ ...prev, isTracking: false }));
  }, [state.activeMethod, advancedTracking, unifiedTracking]);

  const reset = useCallback(() => {
    if (state.activeMethod === 'tensorflow') {
      advancedTracking.reset();
    } else if (state.activeMethod === 'mediapipe') {
      unifiedTracking.reset();
    }
  }, [state.activeMethod, advancedTracking, unifiedTracking]);

  const cleanup = useCallback(() => {
    advancedTracking.cleanup();
    unifiedTracking.stop();
    setState({
      activeMethod: 'none',
      isInitialized: false,
      isTracking: false,
      error: null,
      fallbackReason: null,
    });
  }, [advancedTracking, unifiedTracking]);

  // Get unified data interface
  const getData = useCallback(() => {
    if (state.activeMethod === 'tensorflow') {
      return {
        currentGaze: advancedTracking.currentGaze,
        gazeHistory: advancedTracking.gazeHistory,
        fixations: advancedTracking.fixations,
        saccades: advancedTracking.saccades,
        metrics: advancedTracking.getMetrics(),
      };
    } else if (state.activeMethod === 'mediapipe') {
      return {
        currentGaze: unifiedTracking.currentGaze,
        gazeHistory: unifiedTracking.gazeData,
        fixations: unifiedTracking.fixations,
        saccades: unifiedTracking.saccades,
        metrics: unifiedTracking.getMetrics(),
      };
    }
    return {
      currentGaze: null,
      gazeHistory: [],
      fixations: [],
      saccades: [],
      metrics: null,
    };
  }, [state.activeMethod, advancedTracking, unifiedTracking]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return {
    ...state,
    device,
    initialize,
    startTracking,
    stopTracking,
    reset,
    cleanup,
    getData,
    // Expose raw tracking hooks for direct access if needed
    advancedTracking: state.activeMethod === 'tensorflow' ? advancedTracking : null,
    unifiedTracking: state.activeMethod === 'mediapipe' ? unifiedTracking : null,
  };
}
