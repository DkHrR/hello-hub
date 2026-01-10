import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Database schema for offline storage
interface NeuroReadDB extends DBSchema {
  pendingAssessments: {
    key: string;
    value: PendingAssessment;
    indexes: { 'by-created': string };
  };
  cachedStudents: {
    key: string;
    value: CachedStudent;
  };
  offlineResults: {
    key: string;
    value: OfflineResult;
    indexes: { 'by-synced': number };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-priority': number };
  };
}

export interface PendingAssessment {
  id: string;
  studentId: string | null;
  studentName: string;
  studentAge: number;
  studentGrade: string;
  step: string;
  startedAt: string;
  lastSavedAt: string;
  eyeMetrics: any;
  voiceMetrics: any;
  handwritingMetrics: any;
  transcript: string;
  fixations: any[];
  saccades: any[];
  readingElapsed: number;
  isComplete: boolean;
  createdAt: string;
}

export interface CachedStudent {
  id: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  dateOfBirth: string | null;
  cachedAt: string;
}

export interface OfflineResult {
  id: string;
  assessmentId: string;
  studentId: string | null;
  studentName: string;
  results: any;
  eyeTrackingData: any;
  createdAt: string;
  synced: boolean;
  syncedAt: string | null;
}

export interface SyncQueueItem {
  id: string;
  type: 'assessment' | 'result' | 'student';
  data: any;
  priority: number;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
}

const DB_NAME = 'neuroread-offline';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<NeuroReadDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<NeuroReadDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<NeuroReadDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Pending assessments store
      if (!db.objectStoreNames.contains('pendingAssessments')) {
        const assessmentStore = db.createObjectStore('pendingAssessments', { keyPath: 'id' });
        assessmentStore.createIndex('by-created', 'createdAt');
      }

      // Cached students store
      if (!db.objectStoreNames.contains('cachedStudents')) {
        db.createObjectStore('cachedStudents', { keyPath: 'id' });
      }

      // Offline results store
      if (!db.objectStoreNames.contains('offlineResults')) {
        const resultsStore = db.createObjectStore('offlineResults', { keyPath: 'id' });
        resultsStore.createIndex('by-synced', 'synced');
      }

      // Sync queue store
      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        syncStore.createIndex('by-priority', 'priority');
      }
    },
  });

  return dbInstance;
}

// Pending Assessments
export async function savePendingAssessment(assessment: PendingAssessment): Promise<void> {
  const db = await getDB();
  await db.put('pendingAssessments', assessment);
}

export async function getPendingAssessment(id: string): Promise<PendingAssessment | undefined> {
  const db = await getDB();
  return db.get('pendingAssessments', id);
}

export async function getAllPendingAssessments(): Promise<PendingAssessment[]> {
  const db = await getDB();
  return db.getAll('pendingAssessments');
}

export async function deletePendingAssessment(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pendingAssessments', id);
}

// Cached Students
export async function cacheStudent(student: CachedStudent): Promise<void> {
  const db = await getDB();
  await db.put('cachedStudents', student);
}

export async function getCachedStudents(): Promise<CachedStudent[]> {
  const db = await getDB();
  return db.getAll('cachedStudents');
}

export async function getCachedStudent(id: string): Promise<CachedStudent | undefined> {
  const db = await getDB();
  return db.get('cachedStudents', id);
}

// Offline Results
export async function saveOfflineResult(result: OfflineResult): Promise<void> {
  const db = await getDB();
  await db.put('offlineResults', result);
}

export async function getUnsyncedResults(): Promise<OfflineResult[]> {
  const db = await getDB();
  const all = await db.getAll('offlineResults');
  return all.filter(r => !r.synced);
}

export async function markResultSynced(id: string): Promise<void> {
  const db = await getDB();
  const result = await db.get('offlineResults', id);
  if (result) {
    result.synced = true;
    result.syncedAt = new Date().toISOString();
    await db.put('offlineResults', result);
  }
}

export async function getAllOfflineResults(): Promise<OfflineResult[]> {
  const db = await getDB();
  return db.getAll('offlineResults');
}

// Sync Queue
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'createdAt'>): Promise<void> {
  const db = await getDB();
  await db.put('syncQueue', {
    ...item,
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  });
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('syncQueue', 'by-priority');
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

export async function updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
  const db = await getDB();
  await db.put('syncQueue', item);
}

// Utility functions
export async function getOfflineStats(): Promise<{
  pendingCount: number;
  unsyncedCount: number;
  queueCount: number;
}> {
  const db = await getDB();
  const pending = await db.count('pendingAssessments');
  const unsynced = (await getUnsyncedResults()).length;
  const queue = await db.count('syncQueue');
  
  return {
    pendingCount: pending,
    unsyncedCount: unsynced,
    queueCount: queue,
  };
}

export async function clearAllOfflineData(): Promise<void> {
  const db = await getDB();
  await db.clear('pendingAssessments');
  await db.clear('cachedStudents');
  await db.clear('offlineResults');
  await db.clear('syncQueue');
}
