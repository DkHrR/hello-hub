import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileUp, CheckCircle2, XCircle, Pause, Clock, HardDrive, Zap } from 'lucide-react';
import { useChunkedUpload, UploadProgress } from '@/hooks/useChunkedUpload';
import { toast } from 'sonner';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

interface PreviousUpload {
  id: string;
  file_name: string;
  original_size: number;
  status: string;
  chunks_uploaded: number;
  total_chunks: number;
  created_at: string;
  completed_at: string | null;
}

export function DatasetUploader() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previousUploads, setPreviousUploads] = useState<PreviousUpload[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const { uploadFiles, uploads, isUploading, getUploadsList } = useChunkedUpload({
    chunkSize: 5 * 1024 * 1024, // 5MB chunks
    onComplete: (uploadId, fileName) => {
      console.log(`Upload complete: ${uploadId} - ${fileName}`);
      loadHistory();
    },
    onError: (error, fileName) => {
      console.error(`Upload error for ${fileName}:`, error);
    }
  });

  const loadHistory = useCallback(async () => {
    try {
      const list = await getUploadsList();
      setPreviousUploads(list);
    } catch (e) {
      console.error('Failed to load upload history:', e);
    }
  }, [getUploadsList]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: isUploading,
  });

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.warning('Please select files to upload');
      return;
    }
    
    await uploadFiles(selectedFiles, { dataset: 'etdd70' });
    setSelectedFiles([]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
  const activeUploads = Array.from(uploads.values());

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            ETDD-70 Dataset Upload
          </CardTitle>
          <CardDescription>
            Upload large dataset files using chunked upload (5MB chunks). Files larger than 50MB are automatically split and reassembled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
              }
              ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            <FileUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-primary font-medium">Drop files here...</p>
            ) : (
              <div>
                <p className="font-medium text-foreground">Drag & drop dataset files here</p>
                <p className="text-sm text-muted-foreground mt-1">or click to browse • No file size limit</p>
              </div>
            )}
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  Selected Files ({selectedFiles.length}) • {formatBytes(totalSize)}
                </h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedFiles([])}
                  disabled={isUploading}
                >
                  Clear All
                </Button>
              </div>
              <ScrollArea className="max-h-40">
                <div className="space-y-1">
                  {selectedFiles.map((file, i) => (
                    <div key={`${file.name}-${i}`} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50">
                      <span className="truncate flex-1">{file.name}</span>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-muted-foreground whitespace-nowrap">{formatBytes(file.size)}</span>
                        {!isUploading && (
                          <button 
                            onClick={() => removeFile(i)} 
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <Button onClick={handleUpload} disabled={isUploading} className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} file(s)`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Uploads Progress */}
      {activeUploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Active Uploads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeUploads.map(upload => (
              <UploadProgressCard key={upload.uploadId} progress={upload} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upload History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Upload History
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? 'Hide' : 'Show'} ({previousUploads.length})
            </Button>
          </div>
        </CardHeader>
        {showHistory && previousUploads.length > 0 && (
          <CardContent>
            <ScrollArea className="max-h-60">
              <div className="space-y-2">
                {previousUploads.map(upload => (
                  <div key={upload.id} className="flex items-center justify-between text-sm py-2 px-3 rounded bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{upload.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(upload.original_size)} • {new Date(upload.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="ml-3">
                      <StatusBadge status={upload.status} />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function UploadProgressCard({ progress }: { progress: UploadProgress }) {
  const statusIcon = {
    initializing: <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />,
    uploading: <Upload className="h-4 w-4 text-primary animate-pulse" />,
    complete: <CheckCircle2 className="h-4 w-4 text-primary" />,
    failed: <XCircle className="h-4 w-4 text-destructive" />,
    paused: <Pause className="h-4 w-4 text-accent-foreground" />,
  };

  return (
    <div className="space-y-2 p-3 rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {statusIcon[progress.status]}
          <span className="text-sm font-medium truncate">{progress.fileName}</span>
        </div>
        <span className="text-sm font-mono text-muted-foreground ml-2">
          {progress.percentage}%
        </span>
      </div>
      <Progress value={progress.percentage} className="h-2" />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {formatBytes(progress.bytesUploaded)} / {formatBytes(progress.totalBytes)}
          {' '}• Chunk {progress.chunksUploaded}/{progress.totalChunks}
        </span>
        {progress.status === 'uploading' && progress.speed > 0 && (
          <span>
            {formatBytes(progress.speed)}/s • ETA {formatTime(progress.eta)}
          </span>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    complete: { variant: 'default', label: 'Complete' },
    uploading: { variant: 'secondary', label: 'Uploading' },
    pending: { variant: 'outline', label: 'Pending' },
    failed: { variant: 'destructive', label: 'Failed' },
  };

  const config = variants[status] || { variant: 'outline' as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
