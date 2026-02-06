import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface UploadProgress {
  uploadId: string;
  fileName: string;
  totalChunks: number;
  chunksUploaded: number;
  percentage: number;
  status: 'initializing' | 'uploading' | 'complete' | 'failed' | 'paused';
  bytesUploaded: number;
  totalBytes: number;
  speed: number; // bytes per second
  eta: number; // seconds remaining
}

interface ChunkedUploadOptions {
  chunkSize?: number; // default 5MB
  maxRetries?: number;
  onProgress?: (progress: UploadProgress) => void;
  onComplete?: (uploadId: string, fileName: string) => void;
  onError?: (error: string, fileName: string) => void;
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

export function useChunkedUpload(options: ChunkedUploadOptions = {}) {
  const { 
    chunkSize = DEFAULT_CHUNK_SIZE, 
    maxRetries = 3,
    onProgress, 
    onComplete, 
    onError 
  } = options;

  const [uploads, setUploads] = useState<Map<string, UploadProgress>>(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const speedTracker = useRef<Map<string, { startTime: number; bytesAtStart: number }>>(new Map());

  const updateProgress = useCallback((uploadId: string, update: Partial<UploadProgress>) => {
    setUploads(prev => {
      const next = new Map(prev);
      const current = next.get(uploadId);
      if (current) {
        const updated = { ...current, ...update };
        next.set(uploadId, updated);
        onProgress?.(updated);
      }
      return next;
    });
  }, [onProgress]);

  const uploadChunk = useCallback(async (
    uploadId: string, 
    file: File, 
    chunkIndex: number, 
    retries = 0
  ): Promise<boolean> => {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', String(chunkIndex));
    formData.append('chunk', chunk, `chunk_${chunkIndex}`);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chunked-upload?action=chunk`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      // Update progress
      const tracker = speedTracker.current.get(uploadId);
      const bytesUploaded = end;
      let speed = 0;
      let eta = 0;
      
      if (tracker) {
        const elapsed = (Date.now() - tracker.startTime) / 1000;
        const bytesSinceStart = bytesUploaded - tracker.bytesAtStart;
        speed = elapsed > 0 ? bytesSinceStart / elapsed : 0;
        eta = speed > 0 ? (file.size - bytesUploaded) / speed : 0;
      }

      updateProgress(uploadId, {
        chunksUploaded: result.chunksUploaded,
        percentage: Math.round((result.chunksUploaded / result.totalChunks) * 100),
        bytesUploaded,
        status: result.isComplete ? 'complete' : 'uploading',
        speed,
        eta
      });

      return result.isComplete;
    } catch (error) {
      if (retries < maxRetries) {
        console.warn(`Chunk ${chunkIndex} failed, retrying (${retries + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1))); // exponential backoff
        return uploadChunk(uploadId, file, chunkIndex, retries + 1);
      }
      throw error;
    }
  }, [chunkSize, maxRetries, updateProgress]);

  const uploadFile = useCallback(async (file: File, metadata: Record<string, unknown> = {}) => {
    setIsUploading(true);

    try {
      // Initialize upload via edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const initResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chunked-upload?action=init`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            chunkSize,
            metadata
          }),
        }
      );

      if (!initResponse.ok) {
        const errData = await initResponse.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to initialize upload');
      }

      const initData = await initResponse.json();
      const { uploadId, totalChunks } = initData;

      // Set initial progress
      const initialProgress: UploadProgress = {
        uploadId,
        fileName: file.name,
        totalChunks,
        chunksUploaded: 0,
        percentage: 0,
        status: 'uploading',
        bytesUploaded: 0,
        totalBytes: file.size,
        speed: 0,
        eta: 0
      };

      setUploads(prev => {
        const next = new Map(prev);
        next.set(uploadId, initialProgress);
        return next;
      });
      onProgress?.(initialProgress);

      // Track speed
      speedTracker.current.set(uploadId, { startTime: Date.now(), bytesAtStart: 0 });

      // Upload chunks sequentially
      for (let i = 0; i < totalChunks; i++) {
        const controller = abortControllers.current.get(uploadId);
        if (controller?.signal.aborted) {
          updateProgress(uploadId, { status: 'paused' });
          return uploadId;
        }

        const isComplete = await uploadChunk(uploadId, file, i);
        
        if (isComplete) {
          updateProgress(uploadId, { status: 'complete', percentage: 100 });
          onComplete?.(uploadId, file.name);
          toast.success(`Upload complete: ${file.name}`);
          break;
        }
      }

      return uploadId;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Upload failed';
      console.error('[chunked-upload] Error:', errMsg);
      onError?.(errMsg, file.name);
      toast.error(`Upload failed: ${file.name} - ${errMsg}`);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [chunkSize, onComplete, onError, onProgress, updateProgress, uploadChunk]);

  const uploadFiles = useCallback(async (files: File[], metadata: Record<string, unknown> = {}) => {
    const results: (string | null)[] = [];
    for (const file of files) {
      const uploadId = await uploadFile(file, metadata);
      results.push(uploadId);
    }
    return results;
  }, [uploadFile]);

  const cancelUpload = useCallback((uploadId: string) => {
    const controller = abortControllers.current.get(uploadId);
    if (controller) {
      controller.abort();
    }
    updateProgress(uploadId, { status: 'paused' });
  }, [updateProgress]);

  const getUploadsList = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chunked-upload?action=status`,
      {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      }
    );

    if (!response.ok) return [];
    const data = await response.json();
    return data.uploads || [];
  }, []);

  return {
    uploadFile,
    uploadFiles,
    cancelUpload,
    getUploadsList,
    uploads,
    isUploading
  };
}
