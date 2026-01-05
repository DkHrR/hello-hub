import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RefreshCw, Trash2, Clock, User } from 'lucide-react';
import { format } from 'date-fns';

interface SessionRecoveryModalProps {
  isOpen: boolean;
  sessionData: {
    studentName: string;
    step: string;
    lastSavedAt: string;
    readingElapsed: number;
  } | null;
  onRecover: () => void;
  onDiscard: () => void;
}

export function SessionRecoveryModal({
  isOpen,
  sessionData,
  onRecover,
  onDiscard
}: SessionRecoveryModalProps) {
  if (!isOpen || !sessionData) return null;

  const stepLabels: Record<string, string> = {
    intro: 'Introduction',
    calibration: 'Eye Calibration',
    reading: 'Reading Assessment',
    voice: 'Voice Analysis',
    handwriting: 'Handwriting Analysis',
    processing: 'Processing',
    results: 'Results'
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
      >
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-neuro flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle>Resume Assessment?</CardTitle>
            <CardDescription>
              We found an incomplete assessment session
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Student:</span>
                <span className="font-medium">{sessionData.studentName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Last saved:</span>
                <span className="font-medium">
                  {format(new Date(sessionData.lastSavedAt), 'PPp')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Progress:</span>
                <span className="font-medium">{stepLabels[sessionData.step] || sessionData.step}</span>
              </div>
              {sessionData.readingElapsed > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Reading time:</span>{' '}
                  <span className="font-medium">{sessionData.readingElapsed}s</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onDiscard}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Start Fresh
              </Button>
              <Button
                variant="hero"
                className="flex-1"
                onClick={onRecover}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Resume
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
