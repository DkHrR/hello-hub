import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { useOfflineSync } from '@/hooks/useOfflineSync';

interface OfflineIndicatorProps {
  compact?: boolean;
}

export function OfflineIndicator({ compact = false }: OfflineIndicatorProps) {
  const { status, forceSync } = useOfflineSync();
  
  const totalPending = status.unsyncedCount + status.queueCount;

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            {status.isOnline ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-destructive" />
            )}
            {totalPending > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {totalPending}
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{status.isOnline ? 'Online' : 'Offline'}</p>
          {totalPending > 0 && <p>{totalPending} pending sync</p>}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <AnimatePresence mode="wait">
        {status.isOnline ? (
          <motion.div
            key="online"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2"
          >
            <Wifi className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">Online</span>
          </motion.div>
        ) : (
          <motion.div
            key="offline"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2"
          >
            <WifiOff className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">Offline</span>
          </motion.div>
        )}
      </AnimatePresence>

      {totalPending > 0 && (
        <div className="flex items-center gap-2">
          <CloudOff className="h-4 w-4 text-amber-500" />
          <span className="text-sm text-muted-foreground">
            {totalPending} pending
          </span>
          
          {status.isOnline && !status.isSyncing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={forceSync}
              className="h-7 px-2"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Sync
            </Button>
          )}
        </div>
      )}

      {status.isSyncing && (
        <div className="flex items-center gap-2 min-w-[120px]">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <Progress value={status.syncProgress} className="h-2 w-20" />
          <span className="text-xs text-muted-foreground">
            {Math.round(status.syncProgress)}%
          </span>
        </div>
      )}

      {status.lastSyncAt && totalPending === 0 && !status.isSyncing && (
        <div className="flex items-center gap-1 text-green-500">
          <Check className="h-4 w-4" />
          <span className="text-xs">Synced</span>
        </div>
      )}
    </div>
  );
}

export function OfflineBanner() {
  const { status, forceSync } = useOfflineSync();

  if (status.isOnline) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="bg-amber-500/10 border-b border-amber-500/20"
    >
      <div className="container mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-amber-500" />
          <span className="text-sm text-amber-600 dark:text-amber-400">
            You're offline. Assessments will be saved locally and synced when you're back online.
          </span>
        </div>
        <Badge variant="outline" className="border-amber-500 text-amber-600">
          Offline Mode
        </Badge>
      </div>
    </motion.div>
  );
}
