/**
 * REMoDNaV-style Event Classifier
 * Real-time movement classification for saccades, PSOs, glissades, and fixations
 */

import { useState, useCallback, useRef } from 'react';

export type MovementType = 'fixation' | 'saccade' | 'pso' | 'glissade' | 'blink' | 'unknown';

export interface MovementEvent {
  type: MovementType;
  startTime: number;
  endTime: number;
  duration: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  peakVelocity: number;
  amplitude: number;
  isRegression: boolean;
}

export interface FixationEvent extends MovementEvent {
  type: 'fixation';
  centroidX: number;
  centroidY: number;
  dispersion: number;
  microsaccadeCount: number;
  drift: number;
}

export interface SaccadeEvent extends MovementEvent {
  type: 'saccade';
  direction: number;
  hasPSO: boolean;
  hasGlissade: boolean;
}

export interface REMoDNaVMetrics {
  saccadeCount: number;
  regressionCount: number;
  regressionRate: number;
  psoCount: number;
  glissadeCount: number;
  fixationCount: number;
  averageFixationDuration: number;
  averageSaccadeAmplitude: number;
  totalReadingTime: number;
  events: MovementEvent[];
}

interface GazeSample {
  x: number;
  y: number;
  timestamp: number;
  velocity: number;
}

interface ClassifierConfig {
  saccadeVelocityThreshold: number;
  psoVelocityThreshold: number;
  fixationDispersionThreshold: number;
  fixationDurationThreshold: number;
  microsaccadeAmplitudeThreshold: number;
  pixelsPerDegree: number;
}

const DEFAULT_CONFIG: ClassifierConfig = {
  saccadeVelocityThreshold: 30,
  psoVelocityThreshold: 15,
  fixationDispersionThreshold: 1,
  fixationDurationThreshold: 200,
  microsaccadeAmplitudeThreshold: 1,
  pixelsPerDegree: 35,
};

interface CurrentEvent {
  type: MovementType;
  startTime: number;
  startX: number;
  startY: number;
  samples: GazeSample[];
  peakVelocity: number;
}

interface PostSaccadeState {
  active: boolean;
  saccadeEndTime: number;
  reversalCount: number;
  lastDirection: number;
}

export function useREMoDNaVClassifier(config: Partial<ClassifierConfig> = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  const [events, setEvents] = useState<MovementEvent[]>([]);
  const [currentMovement, setCurrentMovement] = useState<MovementType>('unknown');
  
  const sampleBufferRef = useRef<GazeSample[]>([]);
  const currentEventRef = useRef<CurrentEvent | null>(null);
  const postSaccadeRef = useRef<PostSaccadeState>({
    active: false,
    saccadeEndTime: 0,
    reversalCount: 0,
    lastDirection: 0,
  });

  const pixelsToDegrees = useCallback((pixels: number): number => {
    return pixels / cfg.pixelsPerDegree;
  }, [cfg.pixelsPerDegree]);

  const calculateVelocity = useCallback((p1: GazeSample, p2: GazeSample): number => {
    const dt = (p2.timestamp - p1.timestamp) / 1000;
    if (dt <= 0) return 0;
    const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    return pixelsToDegrees(distance) / dt;
  }, [pixelsToDegrees]);

  const calculateDirection = useCallback((startX: number, startY: number, endX: number, endY: number): number => {
    return Math.atan2(endY - startY, endX - startX);
  }, []);

  const finalizeEvent = useCallback(() => {
    const current = currentEventRef.current;
    if (!current || current.samples.length < 2) {
      currentEventRef.current = null;
      return;
    }
    
    const lastSample = current.samples[current.samples.length - 1];
    const duration = lastSample.timestamp - current.startTime;
    if (duration < 10) {
      currentEventRef.current = null;
      return;
    }
    
    const amplitude = pixelsToDegrees(Math.sqrt(
      Math.pow(lastSample.x - current.startX, 2) + Math.pow(lastSample.y - current.startY, 2)
    ));
    const isRegression = lastSample.x < current.startX;
    
    const event: MovementEvent = {
      type: current.type,
      startTime: current.startTime,
      endTime: lastSample.timestamp,
      duration,
      startX: current.startX,
      startY: current.startY,
      endX: lastSample.x,
      endY: lastSample.y,
      peakVelocity: current.peakVelocity,
      amplitude,
      isRegression,
    };
    
    if (current.type === 'saccade') {
      postSaccadeRef.current = {
        active: true,
        saccadeEndTime: lastSample.timestamp,
        reversalCount: 0,
        lastDirection: calculateDirection(current.startX, current.startY, lastSample.x, lastSample.y),
      };
    }
    
    setEvents(prev => [...prev.slice(-499), event]);
    currentEventRef.current = null;
  }, [pixelsToDegrees, calculateDirection]);

  const processSample = useCallback((x: number, y: number, timestamp: number) => {
    const buffer = sampleBufferRef.current;
    
    let velocity = 0;
    if (buffer.length > 0) {
      velocity = calculateVelocity(buffer[buffer.length - 1], { x, y, timestamp, velocity: 0 });
    }
    
    const sample: GazeSample = { x, y, timestamp, velocity };
    buffer.push(sample);
    if (buffer.length > 100) buffer.shift();
    
    let detectedType: MovementType = 'unknown';
    
    if (velocity > cfg.saccadeVelocityThreshold) {
      detectedType = 'saccade';
    } else if (postSaccadeRef.current.active) {
      const timeSince = timestamp - postSaccadeRef.current.saccadeEndTime;
      if (timeSince < 80 && velocity > cfg.psoVelocityThreshold) {
        detectedType = 'pso';
      } else if (timeSince >= 80 && timeSince < 120 && velocity > cfg.psoVelocityThreshold) {
        detectedType = 'glissade';
      } else if (timeSince >= 120) {
        postSaccadeRef.current.active = false;
        detectedType = 'fixation';
      }
    } else if (velocity < cfg.psoVelocityThreshold) {
      detectedType = 'fixation';
    }
    
    const current = currentEventRef.current;
    if (!current) {
      currentEventRef.current = { type: detectedType, startTime: timestamp, startX: x, startY: y, samples: [sample], peakVelocity: velocity };
    } else if (current.type !== detectedType && detectedType !== 'unknown') {
      finalizeEvent();
      currentEventRef.current = { type: detectedType, startTime: timestamp, startX: x, startY: y, samples: [sample], peakVelocity: velocity };
    } else {
      current.samples.push(sample);
      current.peakVelocity = Math.max(current.peakVelocity, velocity);
    }
    
    setCurrentMovement(detectedType);
    return { type: detectedType, velocity, sample };
  }, [calculateVelocity, cfg, finalizeEvent]);

  const getMetrics = useCallback((): REMoDNaVMetrics => {
    if (currentEventRef.current) finalizeEvent();
    
    const saccades = events.filter(e => e.type === 'saccade');
    const fixations = events.filter(e => e.type === 'fixation');
    const regressions = saccades.filter(s => s.isRegression);
    
    return {
      saccadeCount: saccades.length,
      regressionCount: regressions.length,
      regressionRate: saccades.length > 0 ? (regressions.length / saccades.length) * 100 : 0,
      psoCount: events.filter(e => e.type === 'pso').length,
      glissadeCount: events.filter(e => e.type === 'glissade').length,
      fixationCount: fixations.length,
      averageFixationDuration: fixations.length > 0 ? fixations.reduce((s, f) => s + f.duration, 0) / fixations.length : 0,
      averageSaccadeAmplitude: saccades.length > 0 ? saccades.reduce((s, sc) => s + sc.amplitude, 0) / saccades.length : 0,
      totalReadingTime: events.length > 0 ? events[events.length - 1].endTime - events[0].startTime : 0,
      events,
    };
  }, [events, finalizeEvent]);

  const reset = useCallback(() => {
    setEvents([]);
    setCurrentMovement('unknown');
    sampleBufferRef.current = [];
    currentEventRef.current = null;
    postSaccadeRef.current = { active: false, saccadeEndTime: 0, reversalCount: 0, lastDirection: 0 };
  }, []);

  return { processSample, getMetrics, reset, events, currentMovement, config: cfg };
}
