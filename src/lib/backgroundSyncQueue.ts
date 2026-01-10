import { 
  getSyncQueue, 
  addToSyncQueue, 
  removeSyncQueueItem, 
  updateSyncQueueItem,
  SyncQueueItem 
} from './offlineStorage';

export interface SyncJob {
  id: string;
  type: 'assessment_result' | 'eye_tracking' | 'student' | 'intervention';
  payload: any;
  priority: 'high' | 'medium' | 'low';
  maxRetries: number;
  retryCount: number;
  lastError: string | null;
  lastAttempt: string | null;
  createdAt: string;
  status: 'pending' | 'in_progress' | 'failed' | 'completed';
}

// Priority mapping
const PRIORITY_MAP = {
  high: 1,
  medium: 2,
  low: 3,
};

// Exponential backoff calculation
export function calculateBackoff(retryCount: number, baseDelay = 1000, maxDelay = 60000): number {
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
}

// Check if a job should be retried based on backoff
export function shouldRetryJob(job: SyncQueueItem): boolean {
  if (!job.lastError) return true;
  if (job.retryCount >= 5) return false; // Max 5 retries
  
  const lastAttempt = new Date(job.createdAt).getTime();
  const backoffTime = calculateBackoff(job.retryCount);
  const now = Date.now();
  
  return now - lastAttempt >= backoffTime;
}

// Add a job to the sync queue
export async function enqueueSync(
  type: SyncJob['type'],
  payload: any,
  priority: SyncJob['priority'] = 'medium'
): Promise<string> {
  const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await addToSyncQueue({
    type: type as any,
    data: {
      ...payload,
      _syncJobId: id,
      _priority: priority,
      _maxRetries: 5,
      _status: 'pending',
    },
    priority: PRIORITY_MAP[priority],
    retryCount: 0,
    lastError: null,
  });
  
  return id;
}

// Get pending jobs sorted by priority
export async function getPendingJobs(): Promise<SyncQueueItem[]> {
  const queue = await getSyncQueue();
  return queue
    .filter(job => shouldRetryJob(job))
    .sort((a, b) => a.priority - b.priority);
}

// Mark job as failed with error
export async function markJobFailed(jobId: string, error: string): Promise<void> {
  const queue = await getSyncQueue();
  const job = queue.find(j => j.id === jobId);
  
  if (job) {
    await updateSyncQueueItem({
      ...job,
      retryCount: job.retryCount + 1,
      lastError: error,
    });
  }
}

// Mark job as completed and remove from queue
export async function markJobCompleted(jobId: string): Promise<void> {
  await removeSyncQueueItem(jobId);
}

// Get queue statistics
export async function getQueueStats(): Promise<{
  total: number;
  pending: number;
  failed: number;
  byType: Record<string, number>;
}> {
  const queue = await getSyncQueue();
  
  const stats = {
    total: queue.length,
    pending: queue.filter(j => j.retryCount === 0).length,
    failed: queue.filter(j => j.retryCount > 0).length,
    byType: {} as Record<string, number>,
  };
  
  queue.forEach(job => {
    stats.byType[job.type] = (stats.byType[job.type] || 0) + 1;
  });
  
  return stats;
}

// Clear failed jobs that have exceeded max retries
export async function clearFailedJobs(): Promise<number> {
  const queue = await getSyncQueue();
  let cleared = 0;
  
  for (const job of queue) {
    if (job.retryCount >= 5) {
      await removeSyncQueueItem(job.id);
      cleared++;
    }
  }
  
  return cleared;
}

// Retry all failed jobs immediately
export async function retryAllFailed(): Promise<void> {
  const queue = await getSyncQueue();
  
  for (const job of queue) {
    if (job.retryCount > 0 && job.retryCount < 5) {
      await updateSyncQueueItem({
        ...job,
        retryCount: 0, // Reset retry count to allow immediate retry
        lastError: null,
      });
    }
  }
}
