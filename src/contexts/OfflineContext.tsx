import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useBackgroundSync } from '@/hooks/useBackgroundSync';
import { getCachedStudents, cacheStudent, CachedStudent } from '@/lib/offlineStorage';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
      // Use correct column names from students table (first_name, last_name, grade_level)
      const { data: students } = await supabase
        .from('students')
        .select('id, first_name, last_name, grade_level, date_of_birth')
        .eq('created_by', user.id);

      if (students) {
        for (const student of students) {
          await cacheStudent({
            id: student.id,
            firstName: student.first_name,
            lastName: student.last_name || '',
            gradeLevel: student.grade_level || '',
            dateOfBirth: student.date_of_birth,
            cachedAt: new Date().toISOString(),
          });
        }
        await loadCachedStudents();
      }
    } catch (error) {
      console.error('Failed to cache students:', error);
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