import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Trash2,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { useBackgroundSync } from '@/hooks/useBackgroundSync';
import { formatDistanceToNow } from 'date-fns';

interface BackgroundSyncStatusProps {
  compact?: boolean;
}

export function BackgroundSyncStatus({ compact = false }: BackgroundSyncStatusProps) {
  const {
    isOnline,
    isSyncing,
    lastSyncAt,
    queueStats,
    currentJob,
    progress,
    forceSyncAll,
    clearAllFailed,
  } = useBackgroundSync();

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              {isOnline ? (
                <Cloud className="h-4 w-4 text-green-500" />
              ) : (
                <CloudOff className="h-4 w-4 text-destructive" />
              )}
              {queueStats.total > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {queueStats.total}
                </Badge>
              )}
              {isSyncing && (
                <RefreshCw className="h-3 w-3 animate-spin text-primary" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <p>{isOnline ? 'Online' : 'Offline'}</p>
              {queueStats.total > 0 && (
                <p>{queueStats.pending} pending, {queueStats.failed} retrying</p>
              )}
              {isSyncing && <p>Syncing...</p>}
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Background Sync
            </CardTitle>
            <CardDescription>
              Automatic sync with retry queue
            </CardDescription>
          </div>
          <Badge 
            variant={isOnline ? 'default' : 'destructive'}
            className={isOnline ? 'bg-green-500' : ''}
          >
            {isOnline ? (
              <>
                <Cloud className="h-3 w-3 mr-1" />
                Online
              </>
            ) : (
              <>
                <CloudOff className="h-3 w-3 mr-1" />
                Offline
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Queue Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-primary">{queueStats.total}</p>
            <p className="text-xs text-muted-foreground">Total Queue</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-amber-500">{queueStats.pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-destructive">{queueStats.failed}</p>
            <p className="text-xs text-muted-foreground">Retrying</p>
          </div>
        </div>

        {/* Sync Progress */}
        <AnimatePresence>
          {isSyncing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-primary">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Syncing...
                </span>
                <span className="text-muted-foreground">
                  {Math.round(progress)}%
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              {currentJob && (
                <p className="text-xs text-muted-foreground truncate">
                  Processing: {currentJob}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Job Type Breakdown */}
        {Object.keys(queueStats.byType).length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">Queue by Type</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(queueStats.byType).map(([type, count]) => (
                  <Badge key={type} variant="outline" className="text-xs">
                    {type}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Last Sync */}
        {lastSyncAt && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Last synced {formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true })}
          </div>
        )}

        {/* Status Messages */}
        {!isOnline && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">
              Waiting for connection. Items will sync automatically when online.
            </p>
          </div>
        )}

        {queueStats.failed > 0 && isOnline && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">
              {queueStats.failed} item(s) failed. Retrying with exponential backoff.
            </p>
          </div>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={forceSyncAll}
            disabled={!isOnline || isSyncing || queueStats.total === 0}
            className="flex-1"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync Now
          </Button>
          
          {queueStats.failed > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Failed
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Failed Jobs?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove {queueStats.failed} job(s) that have 
                    exceeded the maximum retry attempts. This data will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAllFailed}>
                    Clear Failed Jobs
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
