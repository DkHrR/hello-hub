import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  getPendingJobs,
  markJobCompleted,
  markJobFailed,
  getQueueStats,
  enqueueSync,
  retryAllFailed,
  clearFailedJobs,
  calculateBackoff,
} from '@/lib/backgroundSyncQueue';
import { SyncQueueItem } from '@/lib/offlineStorage';

interface BackgroundSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  queueStats: {
    total: number;
    pending: number;
    failed: number;
    byType: Record<string, number>;
  };
  currentJob: string | null;
  progress: number;
}

export function useBackgroundSync() {
  const { user } = useAuth();
  const [state, setState] = useState<BackgroundSyncState>({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncAt: null,
    queueStats: { total: 0, pending: 0, failed: 0, byType: {} },
    currentJob: null,
    progress: 0,
  });
  
  const syncLockRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);

  // Update queue stats periodically
  const refreshStats = useCallback(async () => {
    const stats = await getQueueStats();
    setState(prev => ({ ...prev, queueStats: stats }));
  }, []);

  // Process a single sync job
  const processJob = useCallback(async (job: SyncQueueItem): Promise<boolean> => {
    setState(prev => ({ ...prev, currentJob: job.id }));
    
    try {
      switch (job.type) {
        case 'result': {
          const data = job.data;
          
          if (data.studentId) {
            // Create assessment
            const { data: assessment, error: assessmentError } = await supabase
              .from('assessments')
              .insert({
                student_id: data.studentId,
                assessor_id: user?.id,
                assessment_type: 'comprehensive',
                status: 'completed',
                started_at: data.createdAt,
                completed_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (assessmentError) throw assessmentError;

            // Insert eye tracking data
            if (data.eyeTrackingData) {
              const { error: eyeError } = await supabase
                .from('eye_tracking_data')
                .insert({
                  assessment_id: assessment.id,
                  fixation_points: data.eyeTrackingData.fixations,
                  saccade_patterns: data.eyeTrackingData.saccades,
                  average_fixation_duration: data.eyeTrackingData.avgFixationDuration,
                  regression_count: data.eyeTrackingData.regressionCount,
                  reading_speed_wpm: data.eyeTrackingData.readingSpeed,
                  saccade_count: data.eyeTrackingData.saccadeCount,
                  pso_count: data.eyeTrackingData.psoCount,
                  glissade_count: data.eyeTrackingData.glissadeCount,
                  biomarkers: data.eyeTrackingData.biomarkers,
                });
              
              if (eyeError) console.warn('Eye tracking save warning:', eyeError);
            }

            // Insert assessment results
            const { error: resultsError } = await supabase
              .from('assessment_results')
              .insert({
                assessment_id: assessment.id,
                overall_risk_score: data.results?.overallRisk,
                reading_fluency_score: data.results?.readingFluency,
                phonological_awareness_score: data.results?.phonologicalAwareness,
                visual_processing_score: data.results?.visualProcessing,
                attention_score: data.results?.attention,
                recommendations: data.results?.recommendations,
                raw_data: data.results?.rawData,
                dyslexia_biomarkers: data.results?.dyslexiaBiomarkers,
                ai_insights: data.results?.aiInsights,
              });

            if (resultsError) throw resultsError;
          }
          
          return true;
        }
        
        default:
          console.warn(`Unknown sync job type: ${job.type}`);
          return true; // Remove unknown jobs
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Sync job ${job.id} failed:`, errorMessage);
      throw error;
    } finally {
      setState(prev => ({ ...prev, currentJob: null }));
    }
  }, [user]);

  // Main sync loop
  const runSyncLoop = useCallback(async () => {
    if (!state.isOnline || !user || syncLockRef.current) return;
    
    syncLockRef.current = true;
    setState(prev => ({ ...prev, isSyncing: true, progress: 0 }));

    try {
      const jobs = await getPendingJobs();
      
      if (jobs.length === 0) {
        setState(prev => ({ 
          ...prev, 
          isSyncing: false, 
          lastSyncAt: new Date().toISOString() 
        }));
        await refreshStats();
        syncLockRef.current = false;
        return;
      }

      let completed = 0;
      let failed = 0;

      for (const job of jobs) {
        try {
          const success = await processJob(job);
          
          if (success) {
            await markJobCompleted(job.id);
            completed++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await markJobFailed(job.id, errorMessage);
          failed++;
          
          // Schedule retry with backoff
          const backoff = calculateBackoff(job.retryCount + 1);
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }
          retryTimeoutRef.current = setTimeout(() => {
            if (state.isOnline) runSyncLoop();
          }, backoff);
        }

        setState(prev => ({
          ...prev,
          progress: ((completed + failed) / jobs.length) * 100,
        }));
      }

      if (completed > 0) {
        toast.success(`Synced ${completed} assessment(s) successfully!`);
      }
      
      if (failed > 0) {
        toast.warning(`${failed} item(s) failed to sync. Will retry automatically.`);
      }

      setState(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: new Date().toISOString(),
      }));
      
      await refreshStats();
    } catch (error) {
      console.error('Sync loop error:', error);
      setState(prev => ({ ...prev, isSyncing: false }));
    } finally {
      syncLockRef.current = false;
    }
  }, [state.isOnline, user, processJob, refreshStats]);

  // Queue a new assessment result for sync
  const queueAssessmentResult = useCallback(async (
    studentId: string | null,
    studentName: string,
    results: any,
    eyeTrackingData: any
  ): Promise<string> => {
    const jobId = await enqueueSync('assessment_result', {
      studentId,
      studentName,
      results,
      eyeTrackingData,
      createdAt: new Date().toISOString(),
    }, 'high');
    
    await refreshStats();
    
    // Try to sync immediately if online
    if (state.isOnline && !syncLockRef.current) {
      setTimeout(runSyncLoop, 100);
    }
    
    return jobId;
  }, [state.isOnline, runSyncLoop, refreshStats]);

  // Force sync all pending items
  const forceSyncAll = useCallback(async () => {
    if (!state.isOnline) {
      toast.error('Cannot sync while offline');
      return;
    }
    
    await retryAllFailed();
    await runSyncLoop();
  }, [state.isOnline, runSyncLoop]);

  // Clear all permanently failed jobs
  const clearAllFailed = useCallback(async () => {
    const cleared = await clearFailedJobs();
    await refreshStats();
    
    if (cleared > 0) {
      toast.info(`Cleared ${cleared} failed job(s)`);
    }
  }, [refreshStats]);

  // Online/offline handlers
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
      toast.success('Back online! Starting sync...');
      setTimeout(runSyncLoop, 1000);
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
      toast.warning('You are offline. Data will sync when reconnected.');
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [runSyncLoop]);

  // Sync on visibility change (when user returns to tab)
  useEffect(() => {
    visibilityHandlerRef.current = () => {
      if (document.visibilityState === 'visible' && state.isOnline && !syncLockRef.current) {
        runSyncLoop();
      }
    };

    document.addEventListener('visibilitychange', visibilityHandlerRef.current);
    
    return () => {
      if (visibilityHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
      }
    };
  }, [state.isOnline, runSyncLoop]);

  // Initial stats load and periodic refresh
  useEffect(() => {
    refreshStats();
    const interval = setInterval(refreshStats, 30000);
    return () => clearInterval(interval);
  }, [refreshStats]);

  // Initial sync attempt
  useEffect(() => {
    if (state.isOnline && user) {
      const timeout = setTimeout(runSyncLoop, 2000);
      return () => clearTimeout(timeout);
    }
  }, [user]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    queueAssessmentResult,
    forceSyncAll,
    clearAllFailed,
    refreshStats,
  };
}
