import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useBackgroundSync } from '@/hooks/useBackgroundSync';
import { getCachedStudents, cacheStudent, CachedStudent } from '@/lib/offlineStorage';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

interface OfflineContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  cachedStudents: CachedStudent[];
  queueAssessmentResult: (
    studentId: string | null,
    studentName: string,
    results: any,
    eyeTrackingData: any
  ) => Promise<string>;
  forceSyncAll: () => Promise<void>;
  refreshCachedStudents: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { 
    isOnline, 
    isSyncing, 
    queueStats, 
    queueAssessmentResult, 
    forceSyncAll 
  } = useBackgroundSync();
  const [cachedStudents, setCachedStudents] = useState<CachedStudent[]>([]);

  // Load cached students on mount
  useEffect(() => {
    loadCachedStudents();
  }, []);

  // Cache students from server when online
  useEffect(() => {
    if (isOnline && user) {
      cacheStudentsFromServer();
    }
  }, [isOnline, user]);

  const loadCachedStudents = async () => {
    const students = await getCachedStudents();
    setCachedStudents(students);
  };

  const cacheStudentsFromServer = async () => {
    if (!user) return;

    try {
      // Use correct column names from students table (name, grade, age)
      const { data: students } = await supabase
        .from('students')
        .select('id, name, grade, age')
        .eq('clinician_id', user.id);

      if (students) {
        for (const student of students) {
          await cacheStudent({
            id: student.id,
            firstName: student.name.split(' ')[0] || student.name,
            lastName: student.name.split(' ').slice(1).join(' ') || '',
            gradeLevel: student.grade || '',
            dateOfBirth: null,
            cachedAt: new Date().toISOString(),
          });
        }
        await loadCachedStudents();
      }
    } catch (error) {
      logger.error('Failed to cache students', error);
    }
  };

  const refreshCachedStudents = async () => {
    if (isOnline) {
      await cacheStudentsFromServer();
    }
    await loadCachedStudents();
  };

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount: queueStats.pending,
        failedCount: queueStats.failed,
        cachedStudents,
        queueAssessmentResult,
        forceSyncAll,
        refreshCachedStudents,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}
