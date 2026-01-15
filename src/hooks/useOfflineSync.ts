import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  getUnsyncedResults,
  markResultSynced,
  getSyncQueue,
  removeSyncQueueItem,
  updateSyncQueueItem,
  getOfflineStats,
  saveOfflineResult,
  OfflineResult,
} from '@/lib/offlineStorage';

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
  unsyncedCount: number;
  queueCount: number;
  syncProgress: number;
}

export function useOfflineSync() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncAt: null,
    pendingCount: 0,
    unsyncedCount: 0,
    queueCount: 0,
    syncProgress: 0,
  });
  
  const syncInProgress = useRef(false);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update online status
  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
      toast.success('Back online! Syncing data...');
      syncAllData();
    };

    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }));
      toast.warning('You are offline. Data will be saved locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Periodically check for unsynced data
  useEffect(() => {
    const updateStats = async () => {
      const stats = await getOfflineStats();
      setStatus(prev => ({
        ...prev,
        pendingCount: stats.pendingCount,
        unsyncedCount: stats.unsyncedCount,
        queueCount: stats.queueCount,
      }));
    };

    updateStats();
    const interval = setInterval(updateStats, 10000);
    return () => clearInterval(interval);
  }, []);

  // Auto-sync when online
  useEffect(() => {
    if (status.isOnline && user && !syncInProgress.current) {
      syncIntervalRef.current = setInterval(() => {
        syncAllData();
      }, 30000); // Sync every 30 seconds
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [status.isOnline, user]);

  const syncAssessmentResult = async (result: OfflineResult): Promise<boolean> => {
    if (!user) return false;

    try {
      // Calculate risk score
      const riskScore = result.results?.dyslexiaProbabilityIndex || 
                        (result.results?.overallRiskLevel === 'high' ? 0.8 : 
                         result.results?.overallRiskLevel === 'moderate' ? 0.5 : 0.2);

      // Determine risk level
      const riskLevel = riskScore >= 0.6 ? 'high' : riskScore >= 0.3 ? 'moderate' : 'low';

      // Insert into diagnostic_results table
      const { error: resultError } = await supabase
        .from('diagnostic_results')
        .insert({
          clinician_id: user.id,
          user_id: result.studentId ? null : user.id,
          student_id: result.studentId || null,
          session_id: result.assessmentId,
          dyslexia_probability_index: riskScore,
          overall_risk_level: riskLevel,
          // Eye tracking metrics from offline data
          eye_total_fixations: result.eyeTrackingData?.fixations?.length || 0,
          eye_avg_fixation_duration: result.eyeTrackingData?.avgFixationDuration || 0,
          eye_regression_count: result.eyeTrackingData?.regressionCount || 0,
          eye_chaos_index: result.eyeTrackingData?.chaosIndex || 0,
          // Voice metrics
          voice_words_per_minute: result.eyeTrackingData?.readingSpeedWpm || 0,
          voice_fluency_score: (result.results?.readingFluency || 0),
          // Store raw data
          fixation_data: result.eyeTrackingData?.fixations || [],
          saccade_data: result.eyeTrackingData?.saccades || [],
        });

      if (resultError) throw resultError;

      return true;
    } catch (error) {
      logger.error('Failed to sync result', error);
      return false;
    }
  };

  const processSyncQueue = async (): Promise<void> => {
    const queue = await getSyncQueue();
    let processed = 0;

    for (const item of queue) {
      try {
        let success = false;

        // Handle all result-type jobs
        if (item.type === 'assessment_result' || item.type === 'result' || item.type === 'student') {
          success = await syncAssessmentResult(item.data as OfflineResult);
        }

        if (success) {
          await removeSyncQueueItem(item.id);
        } else {
          // Increment retry count
          await updateSyncQueueItem({
            ...item,
            retryCount: item.retryCount + 1,
            lastError: 'Sync failed',
          });
        }

        processed++;
        setStatus(prev => ({
          ...prev,
          syncProgress: (processed / queue.length) * 100,
        }));
      } catch (error) {
        logger.error('Queue item sync failed', error);
      }
    }
  };

  const syncAllData = useCallback(async (): Promise<void> => {
    if (!status.isOnline || !user || syncInProgress.current) return;

    syncInProgress.current = true;
    setStatus(prev => ({ ...prev, isSyncing: true, syncProgress: 0 }));

    try {
      // Sync unsynced results
      const unsyncedResults = await getUnsyncedResults();
      let synced = 0;

      for (const result of unsyncedResults) {
        const success = await syncAssessmentResult(result);
        if (success) {
          await markResultSynced(result.id);
          synced++;
        }
        setStatus(prev => ({
          ...prev,
          syncProgress: (synced / unsyncedResults.length) * 50,
        }));
      }

      // Process sync queue
      await processSyncQueue();

      // Update stats
      const stats = await getOfflineStats();
      setStatus(prev => ({
        ...prev,
        lastSyncAt: new Date().toISOString(),
        pendingCount: stats.pendingCount,
        unsyncedCount: stats.unsyncedCount,
        queueCount: stats.queueCount,
        syncProgress: 100,
      }));

      if (synced > 0) {
        toast.success(`Synced ${synced} assessment(s) successfully!`);
      }
    } catch (error) {
      logger.error('Sync failed', error);
      toast.error('Failed to sync some data. Will retry later.');
    } finally {
      syncInProgress.current = false;
      setStatus(prev => ({ ...prev, isSyncing: false }));
    }
  }, [status.isOnline, user]);

  const saveResultOffline = useCallback(async (
    studentId: string | null,
    studentName: string,
    results: any,
    eyeTrackingData: any
  ): Promise<string> => {
    const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const offlineResult: OfflineResult = {
      id,
      assessmentId: id,
      studentId,
      studentName,
      results,
      eyeTrackingData,
      createdAt: new Date().toISOString(),
      synced: false,
      syncedAt: null,
    };

    await saveOfflineResult(offlineResult);
    
    // Update stats
    const stats = await getOfflineStats();
    setStatus(prev => ({
      ...prev,
      unsyncedCount: stats.unsyncedCount,
    }));

    // Try to sync immediately if online
    if (status.isOnline && user) {
      syncAllData();
    }

    return id;
  }, [status.isOnline, user, syncAllData]);

  const forceSync = useCallback(async (): Promise<void> => {
    if (!status.isOnline) {
      toast.error('Cannot sync while offline');
      return;
    }
    await syncAllData();
  }, [status.isOnline, syncAllData]);

  return {
    status,
    saveResultOffline,
    syncAllData,
    forceSync,
  };
}
