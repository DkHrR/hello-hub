/**
 * Live Assessment Monitor
 * Real-time monitoring dashboard for clinicians to observe assessments
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Eye, 
  User, 
  Clock, 
  Flag, 
  Pause, 
  Play, 
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Activity
} from 'lucide-react';
import { motion } from 'framer-motion';
import { REMoDNaVMetricsPanel } from './REMoDNaVMetricsPanel';
import { REMoDNaVTimeline } from './REMoDNaVTimeline';
import type { REMoDNaVMetrics, MovementType, MovementEvent } from '@/hooks/useREMoDNaVClassifier';
import type { DyslexiaBiomarkers } from '@/hooks/useDyslexiaClassifier';

interface LiveAssessmentMonitorProps {
  studentName: string;
  studentGrade?: string;
  assessmentStep: string;
  elapsedTime: number;
  remoDNavMetrics: REMoDNaVMetrics | null;
  currentMovement: MovementType;
  dyslexiaBiomarkers?: DyslexiaBiomarkers | null;
  onPause?: () => void;
  onResume?: () => void;
  isPaused?: boolean;
  onAddNote?: (note: string) => void;
  onFlagMoment?: (timestamp: number, reason: string) => void;
}

interface ClinicalNote {
  id: string;
  timestamp: number;
  content: string;
  type: 'observation' | 'concern' | 'flag';
}

export function LiveAssessmentMonitor({
  studentName,
  studentGrade,
  assessmentStep,
  elapsedTime,
  remoDNavMetrics,
  currentMovement,
  dyslexiaBiomarkers,
  onPause,
  onResume,
  isPaused = false,
  onAddNote,
  onFlagMoment,
}: LiveAssessmentMonitorProps) {
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [currentNote, setCurrentNote] = useState('');
  const [activeTab, setActiveTab] = useState('metrics');

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleAddNote = (type: ClinicalNote['type'] = 'observation') => {
    if (!currentNote.trim()) return;
    
    const note: ClinicalNote = {
      id: Date.now().toString(),
      timestamp: elapsedTime,
      content: currentNote,
      type,
    };
    
    setNotes(prev => [...prev, note]);
    onAddNote?.(currentNote);
    
    if (type === 'flag') {
      onFlagMoment?.(elapsedTime, currentNote);
    }
    
    setCurrentNote('');
  };

  const getStepLabel = (step: string) => {
    const labels: Record<string, string> = {
      intro: 'Introduction',
      calibration: 'Eye Calibration',
      reading: 'Reading Assessment',
      voice: 'Voice Recording',
      handwriting: 'Handwriting Analysis',
      processing: 'Processing Results',
      results: 'Results',
    };
    return labels[step] || step;
  };

  const getRiskBadge = () => {
    if (!dyslexiaBiomarkers) return null;
    const score = dyslexiaBiomarkers.dyslexiaRiskScore || 0;
    
    if (score < 30) return <Badge className="bg-green-500">Low Risk</Badge>;
    if (score < 60) return <Badge className="bg-yellow-500">Moderate Risk</Badge>;
    return <Badge className="bg-red-500">High Risk</Badge>;
  };

  return (
    <Card className="border-primary/30 bg-card/95 backdrop-blur shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="destructive" className="animate-pulse">
              <span className="mr-1.5 h-2 w-2 rounded-full bg-white inline-block" />
              OBSERVER MODE
            </Badge>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Live Assessment Monitor
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {(onPause || onResume) && (
              <Button
                size="sm"
                variant={isPaused ? 'default' : 'outline'}
                onClick={isPaused ? onResume : onPause}
              >
                {isPaused ? <Play className="h-4 w-4 mr-1" /> : <Pause className="h-4 w-4 mr-1" />}
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Student & Session Info */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{studentName}</span>
              {studentGrade && (
                <Badge variant="outline">{studentGrade}</Badge>
              )}
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{getStepLabel(assessmentStep)}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {getRiskBadge()}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <motion.span
                key={elapsedTime}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                className="font-mono text-lg"
              >
                {formatTime(elapsedTime)}
              </motion.span>
            </div>
          </div>
        </div>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="notes">Clinical Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="mt-4 space-y-4">
            <REMoDNaVMetricsPanel
              metrics={remoDNavMetrics}
              currentMovement={currentMovement}
              isLive
            />
            
            {/* Biomarkers Summary */}
            {dyslexiaBiomarkers && (
              <Card className="bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Dyslexia Biomarkers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Risk Score</p>
                      <p className="text-2xl font-bold">{(dyslexiaBiomarkers.dyslexiaRiskScore || 0).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Risk Level</p>
                      <p className="font-medium capitalize">{dyslexiaBiomarkers.riskLevel || 'unknown'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Prolonged Fixations</p>
                      <p className="font-medium">{(dyslexiaBiomarkers.prolongedFixationRate * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Reading Speed</p>
                      <p className="font-medium">{dyslexiaBiomarkers.estimatedReadingSpeed?.toFixed(0) || 'N/A'} WPM</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <REMoDNaVTimeline
              events={remoDNavMetrics?.events || []}
              totalDuration={elapsedTime}
              currentTime={elapsedTime}
            />
          </TabsContent>

          <TabsContent value="notes" className="mt-4 space-y-4">
            {/* Note Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={currentNote}
                onChange={(e) => setCurrentNote(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
                placeholder="Add clinical observation..."
                className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm"
              />
              <Button size="sm" variant="outline" onClick={() => handleAddNote('observation')}>
                <MessageSquare className="h-4 w-4 mr-1" />
                Note
              </Button>
              <Button size="sm" variant="outline" className="text-yellow-600" onClick={() => handleAddNote('concern')}>
                <AlertTriangle className="h-4 w-4 mr-1" />
                Concern
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleAddNote('flag')}>
                <Flag className="h-4 w-4 mr-1" />
                Flag
              </Button>
            </div>

            {/* Notes List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {notes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No clinical notes yet. Add observations during the assessment.
                </p>
              ) : (
                notes.map((note) => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 rounded-lg border ${
                      note.type === 'flag' 
                        ? 'bg-red-500/10 border-red-500/30' 
                        : note.type === 'concern'
                        ? 'bg-yellow-500/10 border-yellow-500/30'
                        : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {note.type === 'flag' ? (
                          <Flag className="h-4 w-4 text-red-500" />
                        ) : note.type === 'concern' ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-xs font-mono text-muted-foreground">
                          {formatTime(note.timestamp)}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {note.type}
                      </Badge>
                    </div>
                    <p className="text-sm">{note.content}</p>
                  </motion.div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
