import { useState, useCallback, useEffect, useRef } from 'react';
import type { 
  EyeTrackingMetrics, 
  VoiceMetrics, 
  HandwritingMetrics,
  Fixation,
  Saccade 
} from '@/types/diagnostic';
import { useAuth } from '@/contexts/AuthContext';
import { encryptData, decryptData, isCryptoSupported, generateSecureId } from '@/lib/crypto';

const SESSION_STORAGE_KEY = 'neuroread_assessment_session';
const AUTO_SAVE_INTERVAL = 5000; // 5 seconds
const SESSION_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

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

  // Get encryption key (user ID)
  const getEncryptionKey = useCallback(() => {
    if (!user?.id) {
      throw new Error('User must be authenticated for session persistence');
    }
    return user.id;
  }, [user]);

  // Save encrypted session to localStorage
  const saveSession = useCallback(async (session: AssessmentSession) => {
    if (!user?.id) {
      console.warn('Cannot save session: user not authenticated');
      return;
    }

    if (!isCryptoSupported()) {
      console.error('Web Crypto API not supported - session data cannot be securely stored');
      return;
    }

    try {
      const updated = { ...session, lastSavedAt: new Date().toISOString() };
      const jsonData = JSON.stringify(updated);
      const encrypted = await encryptData(jsonData, user.id);
      localStorage.setItem(SESSION_STORAGE_KEY, encrypted);
      currentSessionRef.current = updated;
    } catch (error) {
      // On encryption failure, do NOT store unencrypted data
      console.error('Failed to save session securely');
      localStorage.removeItem(SESSION_STORAGE_KEY);
      throw error;
    }
  }, [user]);

  // Load and decrypt session from localStorage
  const loadSession = useCallback(async (): Promise<AssessmentSession | null> => {
    if (!user?.id) return null;

    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) return null;

    if (!isCryptoSupported()) {
      // Clear potentially unsafe data
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    try {
      const decrypted = await decryptData(saved, user.id);
      const session = JSON.parse(decrypted) as AssessmentSession;
      
      // Validate session age
      const lastSaved = new Date(session.lastSavedAt).getTime();
      const isExpired = Date.now() - lastSaved > SESSION_MAX_AGE_MS;
      
      if (isExpired) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return null;
      }
      
      return session;
    } catch (error) {
      // On decryption failure, clear corrupted/tampered data
      console.error('Failed to decrypt session - clearing data');
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  }, [user]);

  // Check for existing session on mount
  useEffect(() => {
    if (!user?.id) return;

    const checkForSession = async () => {
      try {
        const session = await loadSession();
        
        if (session && session.step !== 'intro' && session.step !== 'results') {
          setHasRecoverableSession(true);
          setRecoveredSession(session);
        }
      } catch {
        // Session check failed - already handled in loadSession
      }
    };

    checkForSession();
  }, [user?.id, loadSession]);

  // Create new session
  const createSession = useCallback(async (data: {
    studentId: string | null;
    studentName: string;
    studentAge: number;
    studentGrade: string;
  }) => {
    const session: AssessmentSession = {
      id: `session_${generateSecureId()}`,
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
    await saveSession(session);
    return session;
  }, [saveSession]);

  // Update session data
  const updateSession = useCallback(async (updates: Partial<AssessmentSession>) => {
    if (!currentSessionRef.current) return;
    
    const updated = { ...currentSessionRef.current, ...updates };
    await saveSession(updated);
  }, [saveSession]);

  // Start auto-save
  const startAutoSave = useCallback((getData: () => Partial<AssessmentSession>) => {
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }

    autoSaveIntervalRef.current = setInterval(async () => {
      const data = getData();
      try {
        await updateSession(data);
      } catch (error) {
        console.error('Auto-save failed');
      }
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

  // Clear on logout
  useEffect(() => {
    if (!user) {
      // User logged out - clear any session data
      localStorage.removeItem(SESSION_STORAGE_KEY);
      currentSessionRef.current = null;
      setHasRecoverableSession(false);
      setRecoveredSession(null);
    }
  }, [user]);

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