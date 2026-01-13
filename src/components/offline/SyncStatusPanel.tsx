import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Trash2, 
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Database
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { 
  getAllOfflineResults, 
  getAllPendingAssessments,
  clearAllOfflineData,
  OfflineResult,
  PendingAssessment 
} from '@/lib/offlineStorage';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { logger } from '@/lib/logger';

export function SyncStatusPanel() {
  const { status, forceSync } = useOfflineSync();
  const [offlineResults, setOfflineResults] = useState<OfflineResult[]>([]);
  const [pendingAssessments, setPendingAssessments] = useState<PendingAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOfflineData();
  }, [status.unsyncedCount]);

  const loadOfflineData = async () => {
    setIsLoading(true);
    try {
      const [results, pending] = await Promise.all([
        getAllOfflineResults(),
        getAllPendingAssessments(),
      ]);
      setOfflineResults(results);
      setPendingAssessments(pending);
    } catch (error) {
      logger.error('Failed to load offline data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllOfflineData();
      await loadOfflineData();
      toast.success('All offline data cleared');
    } catch (error) {
      toast.error('Failed to clear offline data');
    }
  };

  const totalItems = offlineResults.length + pendingAssessments.length;
  const syncedCount = offlineResults.filter(r => r.synced).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Offline Storage
            </CardTitle>
            <CardDescription>
              Manage locally stored assessments and sync status
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {status.isOnline ? (
              <Badge variant="default" className="bg-green-500">
                <Cloud className="h-3 w-3 mr-1" />
                Online
              </Badge>
            ) : (
              <Badge variant="destructive">
                <CloudOff className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sync Status */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <p className="text-3xl font-bold text-primary">{totalItems}</p>
            <p className="text-sm text-muted-foreground">Total Stored</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <p className="text-3xl font-bold text-green-500">{syncedCount}</p>
            <p className="text-sm text-muted-foreground">Synced</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <p className="text-3xl font-bold text-amber-500">{status.unsyncedCount}</p>
            <p className="text-sm text-muted-foreground">Pending Sync</p>
          </div>
        </div>

        {/* Sync Progress */}
        {status.isSyncing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Syncing...
              </span>
              <span>{Math.round(status.syncProgress)}%</span>
            </div>
            <Progress value={status.syncProgress} />
          </div>
        )}

        {/* Last Sync */}
        {status.lastSyncAt && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Last synced {formatDistanceToNow(new Date(status.lastSyncAt), { addSuffix: true })}
          </div>
        )}

        <Separator />

        {/* Stored Items */}
        <div>
          <h4 className="font-medium mb-3">Stored Assessments</h4>
          <ScrollArea className="h-[200px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : totalItems === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No offline data stored</p>
              </div>
            ) : (
              <div className="space-y-2">
                {offlineResults.map((result) => (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      {result.synced ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-amber-500" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{result.studentName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(result.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Badge variant={result.synced ? 'default' : 'secondary'}>
                      {result.synced ? 'Synced' : 'Pending'}
                    </Badge>
                  </motion.div>
                ))}
                {pendingAssessments.map((assessment) => (
                  <motion.div
                    key={assessment.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{assessment.studentName}</p>
                        <p className="text-xs text-muted-foreground">
                          In progress - Step: {assessment.step}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">In Progress</Badge>
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={forceSync}
            disabled={!status.isOnline || status.isSyncing || status.unsyncedCount === 0}
            className="flex-1"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${status.isSyncing ? 'animate-spin' : ''}`} />
            Sync Now
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={totalItems === 0}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear All Offline Data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all locally stored assessments. 
                  Unsynced data will be lost. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAll}>
                  Clear All Data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
