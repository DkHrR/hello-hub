import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { getCachedStudents, cacheStudent, CachedStudent } from '@/lib/offlineStorage';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface OfflineContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  cachedStudents: CachedStudent[];
  saveResultOffline: (
    studentId: string | null,
    studentName: string,
    results: any,
    eyeTrackingData: any
  ) => Promise<string>;
  forceSync: () => Promise<void>;
  refreshCachedStudents: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { status, saveResultOffline, forceSync } = useOfflineSync();
  const [cachedStudents, setCachedStudents] = useState<CachedStudent[]>([]);

  // Load cached students on mount
  useEffect(() => {
    loadCachedStudents();
  }, []);

  // Cache students from server when online
  useEffect(() => {
    if (status.isOnline && user) {
      cacheStudentsFromServer();
    }
  }, [status.isOnline, user]);

  const loadCachedStudents = async () => {
    const students = await getCachedStudents();
    setCachedStudents(students);
  };

  const cacheStudentsFromServer = async () => {
    if (!user) return;

    try {
      const { data: students } = await supabase
        .from('students')
        .select('id, first_name, last_name, grade_level, date_of_birth')
        .eq('created_by', user.id);

      if (students) {
        for (const student of students) {
          await cacheStudent({
            id: student.id,
            firstName: student.first_name,
            lastName: student.last_name,
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
    if (status.isOnline) {
      await cacheStudentsFromServer();
    }
    await loadCachedStudents();
  };

  return (
    <OfflineContext.Provider
      value={{
        isOnline: status.isOnline,
        isSyncing: status.isSyncing,
        pendingCount: status.unsyncedCount + status.queueCount,
        cachedStudents,
        saveResultOffline,
        forceSync,
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
