/**
 * Real-time REMoDNaV Metrics Panel
 * Displays saccade count, regression rate, PSO detection during assessment
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Eye, ArrowLeftRight, Zap, Target, TrendingDown, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { REMoDNaVMetrics, MovementType } from '@/hooks/useREMoDNaVClassifier';

interface REMoDNaVMetricsPanelProps {
  metrics: REMoDNaVMetrics | null;
  currentMovement: MovementType;
  isLive?: boolean;
  compact?: boolean;
}

const MovementIndicator = ({ type }: { type: MovementType }) => {
  const config = {
    fixation: { color: 'bg-blue-500', label: 'Fixation', icon: Target },
    saccade: { color: 'bg-orange-500', label: 'Saccade', icon: ArrowLeftRight },
    pso: { color: 'bg-purple-500', label: 'PSO', icon: Zap },
    glissade: { color: 'bg-pink-500', label: 'Glissade', icon: Activity },
    blink: { color: 'bg-gray-500', label: 'Blink', icon: Eye },
    unknown: { color: 'bg-muted', label: 'Unknown', icon: Eye },
  };

  const { color, label, icon: Icon } = config[type];

  return (
    <motion.div
      key={type}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${color} text-white`}
    >
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium">{label}</span>
    </motion.div>
  );
};

const MetricCard = ({
  label,
  value,
  unit,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: number | string;
  unit?: string;
  icon: React.ElementType;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
}) => (
  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
    <div className={`p-2 rounded-lg ${color}`}>
      <Icon className="h-4 w-4 text-white" />
    </div>
    <div className="flex-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-1">
        <motion.span
          key={String(value)}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-lg font-bold"
        >
          {value}
        </motion.span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
    </div>
    {trend && (
      <TrendingDown
        className={`h-4 w-4 ${
          trend === 'down' ? 'text-green-500' : trend === 'up' ? 'text-red-500 rotate-180' : 'text-muted-foreground'
        }`}
      />
    )}
  </div>
);

const RiskIndicator = ({ rate, label }: { rate: number; label: string }) => {
  const getRiskLevel = (rate: number) => {
    if (rate < 10) return { level: 'Low', color: 'bg-green-500', textColor: 'text-green-600' };
    if (rate < 20) return { level: 'Moderate', color: 'bg-yellow-500', textColor: 'text-yellow-600' };
    return { level: 'High', color: 'bg-red-500', textColor: 'text-red-600' };
  };

  const { level, color, textColor } = getRiskLevel(rate);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Badge variant="outline" className={textColor}>
          {level}
        </Badge>
      </div>
      <div className="relative">
        <Progress value={Math.min(rate, 100)} className="h-2" />
        <div
          className={`absolute top-0 h-2 rounded-full ${color} transition-all`}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
      <p className="text-right text-sm font-medium">{rate.toFixed(1)}%</p>
    </div>
  );
};

export function REMoDNaVMetricsPanel({
  metrics,
  currentMovement,
  isLive = false,
  compact = false,
}: REMoDNaVMetricsPanelProps) {
  const safeMetrics = metrics || {
    saccadeCount: 0,
    regressionCount: 0,
    regressionRate: 0,
    psoCount: 0,
    glissadeCount: 0,
    fixationCount: 0,
    averageFixationDuration: 0,
    averageSaccadeAmplitude: 0,
    totalReadingTime: 0,
    events: [],
  };

  if (compact) {
    return (
      <Card className="border-primary/20 bg-card/80 backdrop-blur">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {isLive && (
                <Badge variant="destructive" className="animate-pulse">
                  <span className="mr-1.5 h-2 w-2 rounded-full bg-white inline-block" />
                  LIVE
                </Badge>
              )}
              <MovementIndicator type={currentMovement} />
            </div>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Saccades: </span>
                <span className="font-bold">{safeMetrics.saccadeCount}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Regressions: </span>
                <span className="font-bold text-orange-500">{safeMetrics.regressionRate.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">PSO: </span>
                <span className="font-bold text-purple-500">{safeMetrics.psoCount}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-card/95 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            REMoDNaV Eye Movement Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            {isLive && (
              <Badge variant="destructive" className="animate-pulse">
                <span className="mr-1.5 h-2 w-2 rounded-full bg-white inline-block" />
                LIVE
              </Badge>
            )}
            <AnimatePresence mode="wait">
              <MovementIndicator type={currentMovement} />
            </AnimatePresence>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Saccade Count"
            value={safeMetrics.saccadeCount}
            icon={ArrowLeftRight}
            color="bg-orange-500"
          />
          <MetricCard
            label="Fixation Count"
            value={safeMetrics.fixationCount}
            icon={Target}
            color="bg-blue-500"
          />
          <MetricCard
            label="PSO Detected"
            value={safeMetrics.psoCount}
            icon={Zap}
            color="bg-purple-500"
          />
          <MetricCard
            label="Glissades"
            value={safeMetrics.glissadeCount}
            icon={Activity}
            color="bg-pink-500"
          />
        </div>

        {/* Risk Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RiskIndicator rate={safeMetrics.regressionRate} label="Regression Rate" />
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Avg Fixation Duration</span>
              <span className="text-sm font-medium">{safeMetrics.averageFixationDuration.toFixed(0)}ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Avg Saccade Amplitude</span>
              <span className="text-sm font-medium">{safeMetrics.averageSaccadeAmplitude.toFixed(2)}°</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Reading Time</span>
              <span className="text-sm font-medium">{(safeMetrics.totalReadingTime / 1000).toFixed(1)}s</span>
            </div>
          </div>
        </div>

        {/* Event Timeline Preview */}
        {safeMetrics.events.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Recent Events (last 20)</p>
            <div className="flex gap-0.5 h-4 overflow-hidden rounded">
              {safeMetrics.events.slice(-20).map((event, i) => {
                const colors = {
                  fixation: 'bg-blue-400',
                  saccade: event.isRegression ? 'bg-red-400' : 'bg-orange-400',
                  pso: 'bg-purple-400',
                  glissade: 'bg-pink-400',
                  blink: 'bg-gray-400',
                  unknown: 'bg-muted',
                };
                return (
                  <motion.div
                    key={i}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    className={`flex-1 ${colors[event.type]}`}
                    title={`${event.type}: ${event.duration.toFixed(0)}ms`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>← Older</span>
              <span>Recent →</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
