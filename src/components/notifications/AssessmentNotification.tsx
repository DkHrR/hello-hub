import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AssessmentNotificationProps {
  isVisible: boolean;
  onClose: () => void;
  onViewResults: () => void;
  studentName: string;
  riskLevel: 'low' | 'moderate' | 'high';
  fluencyScore: number;
}

export function AssessmentNotification({
  isVisible,
  onClose,
  onViewResults,
  studentName,
  riskLevel,
  fluencyScore
}: AssessmentNotificationProps) {
  const riskConfig = {
    low: {
      icon: CheckCircle,
      color: 'bg-success text-success-foreground',
      borderColor: 'border-success',
      label: 'Low Risk'
    },
    moderate: {
      icon: Info,
      color: 'bg-warning text-warning-foreground',
      borderColor: 'border-warning',
      label: 'Moderate Risk'
    },
    high: {
      icon: AlertTriangle,
      color: 'bg-destructive text-destructive-foreground',
      borderColor: 'border-destructive',
      label: 'High Risk'
    }
  };

  const config = riskConfig[riskLevel];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, x: 20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: -20, x: 20 }}
          className="fixed top-20 right-4 z-50 max-w-sm"
        >
          <div className={`rounded-lg border ${config.borderColor} bg-card shadow-lg overflow-hidden`}>
            <div className={`${config.color} px-4 py-2 flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span className="font-medium">Assessment Complete</span>
              </div>
              <button
                onClick={onClose}
                className="hover:opacity-70 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4">
              <p className="font-semibold">{studentName}</p>
              <div className="flex items-center justify-between mt-2 text-sm">
                <span className="text-muted-foreground">Risk Level:</span>
                <span className={`font-medium ${
                  riskLevel === 'high' ? 'text-destructive' :
                  riskLevel === 'moderate' ? 'text-warning' : 'text-success'
                }`}>
                  {config.label}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fluency Score:</span>
                <span className="font-medium">{fluencyScore}%</span>
              </div>
              
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
                  Dismiss
                </Button>
                <Button variant="hero" size="sm" onClick={onViewResults} className="flex-1">
                  View Results
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
