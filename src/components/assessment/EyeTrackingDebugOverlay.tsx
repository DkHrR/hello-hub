import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EyeTrackingDebugInfo } from '@/types/diagnostic';
import { Eye, Activity, Crosshair, Cpu, Clock, AlertTriangle } from 'lucide-react';

interface EyeTrackingDebugOverlayProps {
  debugInfo: EyeTrackingDebugInfo;
  isCalibrated: boolean;
  isTracking: boolean;
}

export function EyeTrackingDebugOverlay({
  debugInfo,
  isCalibrated,
  isTracking
}: EyeTrackingDebugOverlayProps) {
  const [isVisible, setIsVisible] = useState(() => {
    return localStorage.getItem('eyeTrackingDebug') === 'true';
  });
  const [showGazeDot, setShowGazeDot] = useState(true);

  // Keyboard shortcut: Ctrl+Shift+D to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsVisible(prev => {
          const newValue = !prev;
          localStorage.setItem('eyeTrackingDebug', String(newValue));
          return newValue;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Get backend color
  const getBackendColor = () => {
    switch (debugInfo.backend) {
      case 'mediapipe':
        return 'bg-success';
      case 'webgazer':
        return 'bg-warning';
      case 'none':
        return 'bg-destructive';
    }
  };

  // Get FPS color
  const getFpsColor = () => {
    if (debugInfo.fps >= 25) return 'text-success';
    if (debugInfo.fps >= 15) return 'text-warning';
    return 'text-destructive';
  };

  // Get confidence color
  const getConfidenceColor = () => {
    if (debugInfo.confidence >= 0.7) return 'text-success';
    if (debugInfo.confidence >= 0.4) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <>
      {/* Gaze Position Dot */}
      <AnimatePresence>
        {isVisible && showGazeDot && debugInfo.gazeX !== undefined && debugInfo.gazeY !== undefined && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 0.8, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="fixed pointer-events-none z-[100]"
            style={{
              left: debugInfo.gazeX,
              top: debugInfo.gazeY,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className={`w-4 h-4 rounded-full ${getBackendColor()} ring-2 ring-white shadow-lg`}>
              <div className="absolute inset-0 rounded-full animate-ping opacity-50" 
                   style={{ backgroundColor: 'inherit' }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debug Panel */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed bottom-4 right-4 z-50 font-mono text-xs bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-xl min-w-[240px]"
          >
            {/* Header */}
            <div className="flex items-center gap-2 p-3 border-b border-border">
              <div className={`w-2.5 h-2.5 rounded-full ${getBackendColor()} ${isTracking ? 'animate-pulse' : ''}`} />
              <Eye className="w-4 h-4 text-primary" />
              <span className="font-semibold text-foreground">Eye Tracking Debug</span>
            </div>

            {/* Stats */}
            <div className="p-3 space-y-2">
              {/* Backend */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  Backend
                </span>
                <span className={`font-medium capitalize ${
                  debugInfo.backend === 'mediapipe' ? 'text-success' :
                  debugInfo.backend === 'webgazer' ? 'text-warning' : 'text-destructive'
                }`}>
                  {debugInfo.backend}
                </span>
              </div>

              {/* FPS */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  FPS
                </span>
                <span className={`font-medium ${getFpsColor()}`}>
                  {debugInfo.fps}
                </span>
              </div>

              {/* Landmarks */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5" />
                  Landmarks
                </span>
                <span className="font-medium text-foreground">
                  {debugInfo.landmarkCount}
                  {debugInfo.landmarkCount === 478 && (
                    <span className="ml-1 text-success">(iris)</span>
                  )}
                </span>
              </div>

              {/* Gaze Position */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Gaze</span>
                <span className="font-medium text-foreground">
                  ({debugInfo.gazeX?.toFixed(0) ?? '—'}, {debugInfo.gazeY?.toFixed(0) ?? '—'})
                </span>
              </div>

              {/* Confidence */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Confidence</span>
                <span className={`font-medium ${getConfidenceColor()}`}>
                  {(debugInfo.confidence * 100).toFixed(0)}%
                </span>
              </div>

              {/* Status Row */}
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="text-muted-foreground">Status</span>
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    isCalibrated ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                  }`}>
                    {isCalibrated ? 'CAL' : 'UNCAL'}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    isTracking ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {isTracking ? 'TRACKING' : 'STOPPED'}
                  </span>
                </div>
              </div>

              {/* Init Time */}
              {debugInfo.initializationTime !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Init Time
                  </span>
                  <span className="font-medium text-foreground">
                    {debugInfo.initializationTime}ms
                  </span>
                </div>
              )}

              {/* Error Message */}
              {debugInfo.errorMessage && (
                <div className="flex items-start gap-1.5 p-2 bg-destructive/10 rounded text-destructive">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span className="text-[10px] leading-tight">{debugInfo.errorMessage}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-border flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Ctrl+Shift+D to toggle</span>
              <button
                onClick={() => setShowGazeDot(!showGazeDot)}
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  showGazeDot ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                {showGazeDot ? 'Hide Dot' : 'Show Dot'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}