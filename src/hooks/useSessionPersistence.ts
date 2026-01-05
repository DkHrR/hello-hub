import { useState, useCallback, useEffect, useRef } from 'react';
import type { 
  EyeTrackingMetrics, 
  VoiceMetrics, 
  HandwritingMetrics,
  Fixation,
  Saccade 
} from '@/types/diagnostic';
import { useAuth } from '@/contexts/AuthContext';

const SESSION_STORAGE_KEY = 'neuroread_assessment_session';
const AUTO_SAVE_INTERVAL = 5000; // 5 seconds

interface AssessmentSession {
  id: string;
  studentId: string | null;
  studentName: string;
  studentAge: number;
  studentGrade: string;
  step: string;
  startedAt: string;
  lastSavedAt: string;
  eyeMetrics: EyeTrackingMetrics | null;
  voiceMetrics: VoiceMetrics | null;
  handwritingMetrics: HandwritingMetrics | null;
  transcript: string;
  fixations: Fixation[];
  saccades: Saccade[];
  readingElapsed: number;
}

export function useSessionPersistence() {
  const { user } = useAuth();
  const [hasRecoverableSession, setHasRecoverableSession] = useState(false);
  const [recoveredSession, setRecoveredSession] = useState<AssessmentSession | null>(null);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSessionRef = useRef<AssessmentSession | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (saved) {
      try {
        const session = JSON.parse(saved) as AssessmentSession;
        // Only recover if session is less than 1 hour old
        const lastSaved = new Date(session.lastSavedAt).getTime();
        const hourAgo = Date.now() - 60 * 60 * 1000;
        
        if (lastSaved > hourAgo && session.step !== 'intro' && session.step !== 'results') {
          setHasRecoverableSession(true);
          setRecoveredSession(session);
        } else {
          // Session too old, clear it
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  }, []);

  // Create new session
  const createSession = useCallback((data: {
    studentId: string | null;
    studentName: string;
    studentAge: number;
    studentGrade: string;
  }) => {
    const session: AssessmentSession = {
      id: `session_${Date.now()}`,
      studentId: data.studentId,
      studentName: data.studentName,
      studentAge: data.studentAge,
      studentGrade: data.studentGrade,
      step: 'intro',
      startedAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
      eyeMetrics: null,
      voiceMetrics: null,
      handwritingMetrics: null,
      transcript: '',
      fixations: [],
      saccades: [],
      readingElapsed: 0
    };

    currentSessionRef.current = session;
    saveSession(session);
    return session;
  }, []);

  // Save session to localStorage
  const saveSession = useCallback((session: AssessmentSession) => {
    const updated = { ...session, lastSavedAt: new Date().toISOString() };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
    currentSessionRef.current = updated;
  }, []);

  // Update session data
  const updateSession = useCallback((updates: Partial<AssessmentSession>) => {
    if (!currentSessionRef.current) return;
    
    const updated = { ...currentSessionRef.current, ...updates };
    saveSession(updated);
  }, [saveSession]);

  // Start auto-save
  const startAutoSave = useCallback((getData: () => Partial<AssessmentSession>) => {
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }

    autoSaveIntervalRef.current = setInterval(() => {
      const data = getData();
      updateSession(data);
    }, AUTO_SAVE_INTERVAL);
  }, [updateSession]);

  // Stop auto-save
  const stopAutoSave = useCallback(() => {
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
      autoSaveIntervalRef.current = null;
    }
  }, []);

  // Recover session
  const recoverSession = useCallback(() => {
    if (recoveredSession) {
      currentSessionRef.current = recoveredSession;
      setHasRecoverableSession(false);
      return recoveredSession;
    }
    return null;
  }, [recoveredSession]);

  // Discard recovered session
  const discardRecoveredSession = useCallback(() => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setHasRecoverableSession(false);
    setRecoveredSession(null);
  }, []);

  // Clear session (on completion or manual reset)
  const clearSession = useCallback(() => {
    stopAutoSave();
    localStorage.removeItem(SESSION_STORAGE_KEY);
    currentSessionRef.current = null;
    setHasRecoverableSession(false);
    setRecoveredSession(null);
  }, [stopAutoSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAutoSave();
    };
  }, [stopAutoSave]);

  return {
    hasRecoverableSession,
    recoveredSession,
    createSession,
    updateSession,
    startAutoSave,
    stopAutoSave,
    recoverSession,
    discardRecoveredSession,
    clearSession
  };
}
