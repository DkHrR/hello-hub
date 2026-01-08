/**
 * ST-GAZE Pipeline: Spatio-Temporal Gated Recurrent Unit-like gaze estimation
 * 
 * Implements:
 * 1. Sliding window temporal smoothing (5 frames)
 * 2. GRU-like gate mechanism for adaptive smoothing
 * 3. Ridge Regression calibration for sub-degree accuracy
 * 4. Saccadic jump preservation during rapid eye movements
 */

import { useCallback, useRef } from 'react';

interface GazeFrame {
  x: number;
  y: number;
  timestamp: number;
  velocity: number;
}

interface GRUState {
  hidden: { x: number; y: number };
  resetGate: number;
  updateGate: number;
}

interface RidgeCalibration {
  weights: { wx: number[]; wy: number[] };
  bias: { bx: number; by: number };
  lambda: number; // Regularization parameter
  isCalibrated: boolean;
  calibrationPoints: Array<{ input: number[]; target: { x: number; y: number } }>;
}

interface STGazeConfig {
  windowSize: number;
  saccadeThreshold: number; // degrees per second
  gruDecay: number;
  ridgeLambda: number;
}

const DEFAULT_CONFIG: STGazeConfig = {
  windowSize: 5,
  saccadeThreshold: 30, // 30°/sec threshold for saccade detection
  gruDecay: 0.15,
  ridgeLambda: 0.1,
};

export function useSTGazePipeline(config: Partial<STGazeConfig> = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Sliding window buffer
  const windowBufferRef = useRef<GazeFrame[]>([]);
  
  // GRU-like state
  const gruStateRef = useRef<GRUState>({
    hidden: { x: 0, y: 0 },
    resetGate: 0,
    updateGate: 0,
  });
  
  // Ridge Regression calibration state
  const calibrationRef = useRef<RidgeCalibration>({
    weights: { wx: [1, 0, 0], wy: [0, 1, 0] }, // Default: identity transform
    bias: { bx: 0, by: 0 },
    lambda: cfg.ridgeLambda,
    isCalibrated: false,
    calibrationPoints: [],
  });

  // Calculate velocity between two points (pixels per second)
  const calculateVelocity = useCallback((
    p1: { x: number; y: number; timestamp: number },
    p2: { x: number; y: number; timestamp: number }
  ): number => {
    const dt = (p2.timestamp - p1.timestamp) / 1000; // seconds
    if (dt <= 0) return 0;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    // Convert to degrees (approximate: 1 degree ≈ 35 pixels at typical viewing distance)
    const distanceDegrees = distance / 35;
    return distanceDegrees / dt;
  }, []);

  // Sigmoid activation for gates
  const sigmoid = useCallback((x: number): number => {
    return 1 / (1 + Math.exp(-x));
  }, []);

  // GRU-like gating mechanism
  // Preserves saccadic sharpness while smoothing fixations
  const applyGRUGating = useCallback((
    currentInput: { x: number; y: number },
    velocity: number
  ): { x: number; y: number } => {
    const state = gruStateRef.current;
    
    // Calculate reset gate: higher velocity = more reset (preserve saccade sharpness)
    const velocityNormalized = Math.min(velocity / cfg.saccadeThreshold, 3);
    const resetGate = sigmoid(velocityNormalized * 2 - 1);
    
    // Calculate update gate: inverse of reset (smooth during fixation)
    const updateGate = 1 - resetGate * cfg.gruDecay;
    
    // Apply gating
    const newHidden = {
      x: updateGate * state.hidden.x + (1 - updateGate) * currentInput.x,
      y: updateGate * state.hidden.y + (1 - updateGate) * currentInput.y,
    };
    
    // If saccade detected (high velocity), reset hidden state
    if (velocity > cfg.saccadeThreshold) {
      // Pass through raw input for sharp saccadic jumps
      newHidden.x = currentInput.x;
      newHidden.y = currentInput.y;
    }
    
    // Update state
    gruStateRef.current = {
      hidden: newHidden,
      resetGate,
      updateGate,
    };
    
    return newHidden;
  }, [cfg.saccadeThreshold, cfg.gruDecay, sigmoid]);

  // Ridge Regression training
  // X^T * X + λI)^-1 * X^T * y
  const trainRidgeRegression = useCallback(() => {
    const cal = calibrationRef.current;
    if (cal.calibrationPoints.length < 5) return false;
    
    const n = cal.calibrationPoints.length;
    const featureDim = 3; // x, y, 1 (bias)
    
    // Build matrices
    const X: number[][] = [];
    const Yx: number[] = [];
    const Yy: number[] = [];
    
    for (const point of cal.calibrationPoints) {
      X.push(point.input);
      Yx.push(point.target.x);
      Yy.push(point.target.y);
    }
    
    // Compute X^T * X
    const XTX: number[][] = Array(featureDim).fill(0).map(() => Array(featureDim).fill(0));
    for (let i = 0; i < featureDim; i++) {
      for (let j = 0; j < featureDim; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += X[k][i] * X[k][j];
        }
        XTX[i][j] = sum + (i === j ? cal.lambda : 0); // Add regularization
      }
    }
    
    // Compute X^T * Y
    const XTYx: number[] = Array(featureDim).fill(0);
    const XTYy: number[] = Array(featureDim).fill(0);
    for (let i = 0; i < featureDim; i++) {
      let sumX = 0, sumY = 0;
      for (let k = 0; k < n; k++) {
        sumX += X[k][i] * Yx[k];
        sumY += X[k][i] * Yy[k];
      }
      XTYx[i] = sumX;
      XTYy[i] = sumY;
    }
    
    // Solve using Gaussian elimination (simplified for 3x3)
    const solveLinear = (A: number[][], b: number[]): number[] => {
      const n = A.length;
      const aug: number[][] = A.map((row, i) => [...row, b[i]]);
      
      // Forward elimination
      for (let i = 0; i < n; i++) {
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
          if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
        }
        [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
        
        if (Math.abs(aug[i][i]) < 1e-10) continue;
        
        for (let k = i + 1; k < n; k++) {
          const factor = aug[k][i] / aug[i][i];
          for (let j = i; j <= n; j++) {
            aug[k][j] -= factor * aug[i][j];
          }
        }
      }
      
      // Back substitution
      const x = Array(n).fill(0);
      for (let i = n - 1; i >= 0; i--) {
        x[i] = aug[i][n];
        for (let j = i + 1; j < n; j++) {
          x[i] -= aug[i][j] * x[j];
        }
        x[i] /= aug[i][i] || 1;
      }
      return x;
    };
    
    try {
      cal.weights.wx = solveLinear(XTX.map(r => [...r]), XTYx);
      cal.weights.wy = solveLinear(XTX.map(r => [...r]), XTYy);
      cal.bias.bx = cal.weights.wx[2] || 0;
      cal.bias.by = cal.weights.wy[2] || 0;
      cal.isCalibrated = true;
      return true;
    } catch {
      return false;
    }
  }, []);

  // Add calibration point
  const addCalibrationPoint = useCallback((
    rawGaze: { x: number; y: number },
    targetScreen: { x: number; y: number }
  ) => {
    // Normalize inputs
    const input = [
      rawGaze.x / window.innerWidth,
      rawGaze.y / window.innerHeight,
      1, // bias term
    ];
    
    calibrationRef.current.calibrationPoints.push({
      input,
      target: targetScreen,
    });
  }, []);

  // Apply Ridge Regression to map gaze to screen
  const applyCalibration = useCallback((rawGaze: { x: number; y: number }): { x: number; y: number } => {
    const cal = calibrationRef.current;
    if (!cal.isCalibrated) return rawGaze;
    
    const input = [
      rawGaze.x / window.innerWidth,
      rawGaze.y / window.innerHeight,
      1,
    ];
    
    const screenX = input[0] * cal.weights.wx[0] + input[1] * cal.weights.wx[1] + cal.weights.wx[2];
    const screenY = input[0] * cal.weights.wy[0] + input[1] * cal.weights.wy[1] + cal.weights.wy[2];
    
    return {
      x: Math.max(0, Math.min(window.innerWidth, screenX)),
      y: Math.max(0, Math.min(window.innerHeight, screenY)),
    };
  }, []);

  // Main processing function
  const processGazeFrame = useCallback((
    rawX: number,
    rawY: number,
    timestamp: number
  ): { x: number; y: number; velocity: number; isSaccade: boolean } => {
    const buffer = windowBufferRef.current;
    
    // Calculate velocity
    let velocity = 0;
    if (buffer.length > 0) {
      const lastFrame = buffer[buffer.length - 1];
      velocity = calculateVelocity(
        { x: lastFrame.x, y: lastFrame.y, timestamp: lastFrame.timestamp },
        { x: rawX, y: rawY, timestamp }
      );
    }
    
    // Add to sliding window
    const newFrame: GazeFrame = { x: rawX, y: rawY, timestamp, velocity };
    buffer.push(newFrame);
    
    // Keep window size
    while (buffer.length > cfg.windowSize) {
      buffer.shift();
    }
    
    // Calculate weighted average for spatial smoothing
    let weightedX = 0, weightedY = 0, totalWeight = 0;
    const isSaccade = velocity > cfg.saccadeThreshold;
    
    if (!isSaccade) {
      // Apply temporal smoothing during fixation
      for (let i = 0; i < buffer.length; i++) {
        // More recent frames get higher weight
        const weight = (i + 1) / buffer.length;
        weightedX += buffer[i].x * weight;
        weightedY += buffer[i].y * weight;
        totalWeight += weight;
      }
      weightedX /= totalWeight;
      weightedY /= totalWeight;
    } else {
      // During saccade, use raw position
      weightedX = rawX;
      weightedY = rawY;
    }
    
    // Apply GRU gating
    const gatedGaze = applyGRUGating({ x: weightedX, y: weightedY }, velocity);
    
    // Apply Ridge Regression calibration
    const calibratedGaze = applyCalibration(gatedGaze);
    
    return {
      ...calibratedGaze,
      velocity,
      isSaccade,
    };
  }, [cfg.windowSize, cfg.saccadeThreshold, calculateVelocity, applyGRUGating, applyCalibration]);

  // Finalize calibration
  const finalizeCalibration = useCallback((): boolean => {
    return trainRidgeRegression();
  }, [trainRidgeRegression]);

  // Reset pipeline
  const reset = useCallback(() => {
    windowBufferRef.current = [];
    gruStateRef.current = {
      hidden: { x: 0, y: 0 },
      resetGate: 0,
      updateGate: 0,
    };
  }, []);

  // Clear calibration
  const clearCalibration = useCallback(() => {
    calibrationRef.current = {
      weights: { wx: [1, 0, 0], wy: [0, 1, 0] },
      bias: { bx: 0, by: 0 },
      lambda: cfg.ridgeLambda,
      isCalibrated: false,
      calibrationPoints: [],
    };
  }, [cfg.ridgeLambda]);

  return {
    processGazeFrame,
    addCalibrationPoint,
    finalizeCalibration,
    reset,
    clearCalibration,
    isCalibrated: calibrationRef.current.isCalibrated,
    config: cfg,
  };
}
