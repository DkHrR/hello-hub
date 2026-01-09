/**
 * AI Insights Panel
 * Displays AI-generated recommendations and intervention strategies
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Brain, 
  RefreshCw, 
  Copy, 
  Check, 
  Lightbulb,
  BookOpen,
  Calendar,
  TrendingUp,
  Clipboard,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAIInsights, type AIInsights } from '@/hooks/useAIInsights';
import type { DiagnosticResult } from '@/types/diagnostic';
import type { DyslexiaBiomarkers } from '@/hooks/useDyslexiaClassifier';
import type { REMoDNaVMetrics } from '@/hooks/useREMoDNaVClassifier';
import { useToast } from '@/hooks/use-toast';

interface AIInsightsPanelProps {
  diagnosticResult: DiagnosticResult;
  biomarkers?: DyslexiaBiomarkers;
  remoDNavMetrics?: REMoDNaVMetrics;
  studentInfo?: { name: string; grade: string; age?: number };
  onIncludeInReport?: (insights: AIInsights) => void;
}

export function AIInsightsPanel({
  diagnosticResult,
  biomarkers,
  remoDNavMetrics,
  studentInfo,
  onIncludeInReport,
}: AIInsightsPanelProps) {
  const { toast } = useToast();
  const { insights, isLoading, error, generateInsights, regenerate, clearInsights } = useAIInsights();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('findings');

  const handleGenerate = async () => {
    await generateInsights(diagnosticResult, biomarkers, remoDNavMetrics, studentInfo);
  };

  const handleCopy = async () => {
    if (!insights) return;
    
    const textContent = `
AI-Generated Insights for ${studentInfo?.name || 'Student'}
============================================

Summary:
${insights.summary}

Key Findings:
${insights.keyFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Intervention Strategies:
${insights.interventionStrategies.map(s => `- ${s.title} (${s.priority} priority): ${s.description}`).join('\n')}

Reading Recommendations:
Level: ${insights.readingRecommendations.level}
Materials: ${insights.readingRecommendations.materials.join(', ')}
Focus Areas: ${insights.readingRecommendations.focusAreas.join(', ')}

Weekly Plan:
${insights.weeklyPlan.map(d => `${d.day}: ${d.activity} (${d.duration})`).join('\n')}

Progress Forecast:
${insights.progressForecast}

Clinical Notes:
${insights.clinicalNotes}

Confidence: ${(insights.confidence * 100).toFixed(0)}%
    `.trim();

    await navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied to clipboard' });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-muted';
    }
  };

  if (!insights && !isLoading) {
    return (
      <Card className="border-primary/20 border-dashed">
        <CardContent className="py-12 text-center">
          <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">AI-Powered Insights</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            Generate personalized intervention strategies and recommendations based on the diagnostic results using advanced AI analysis.
          </p>
          <Button onClick={handleGenerate} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generate AI Insights
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 animate-pulse text-primary" />
            Generating AI Insights...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-12 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-10 w-10 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-medium mb-2">Failed to Generate Insights</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={handleGenerate} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!insights) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI-Powered Insights
            <Badge variant="secondary" className="ml-2">
              {(insights.confidence * 100).toFixed(0)}% Confidence
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={regenerate}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Regenerate
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            {onIncludeInReport && (
              <Button size="sm" variant="outline" onClick={() => onIncludeInReport(insights)}>
                <Clipboard className="h-4 w-4 mr-1" />
                Add to Report
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-sm leading-relaxed">{insights.summary}</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="findings" className="gap-1">
              <Lightbulb className="h-3 w-3" />
              Findings
            </TabsTrigger>
            <TabsTrigger value="interventions" className="gap-1">
              <BookOpen className="h-3 w-3" />
              Interventions
            </TabsTrigger>
            <TabsTrigger value="plan" className="gap-1">
              <Calendar className="h-3 w-3" />
              Weekly Plan
            </TabsTrigger>
            <TabsTrigger value="forecast" className="gap-1">
              <TrendingUp className="h-3 w-3" />
              Forecast
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <TabsContent value="findings" className="mt-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <h4 className="font-medium">Key Findings</h4>
                <ul className="space-y-2">
                  {insights.keyFindings.map((finding, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-sm font-medium">
                        {i + 1}
                      </div>
                      <p className="text-sm">{finding}</p>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </TabsContent>

            <TabsContent value="interventions" className="mt-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <h4 className="font-medium">Intervention Strategies</h4>
                <div className="space-y-3">
                  {insights.interventionStrategies.map((strategy, i) => (
                    <div key={i} className="p-3 rounded-lg border bg-card">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium">{strategy.title}</h5>
                        <Badge className={`${getPriorityColor(strategy.priority)} text-white`}>
                          {strategy.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{strategy.description}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Frequency: {strategy.frequency}</span>
                        <span>Duration: {strategy.duration}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reading Recommendations */}
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Reading Recommendations</h4>
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="text-sm mb-2">
                      <strong>Reading Level:</strong> {insights.readingRecommendations.level}
                    </p>
                    <p className="text-sm mb-2">
                      <strong>Suggested Materials:</strong>
                    </p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground mb-2">
                      {insights.readingRecommendations.materials.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                    <p className="text-sm">
                      <strong>Focus Areas:</strong>{' '}
                      {insights.readingRecommendations.focusAreas.join(', ')}
                    </p>
                  </div>
                </div>
              </motion.div>
            </TabsContent>

            <TabsContent value="plan" className="mt-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <h4 className="font-medium">Weekly Practice Plan</h4>
                <div className="grid gap-2">
                  {insights.weeklyPlan.map((day, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-20 font-medium text-sm">{day.day}</div>
                        <p className="text-sm">{day.activity}</p>
                      </div>
                      <Badge variant="outline">{day.duration}</Badge>
                    </div>
                  ))}
                </div>
              </motion.div>
            </TabsContent>

            <TabsContent value="forecast" className="mt-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <h4 className="font-medium">Progress Forecast</h4>
                <div className="p-4 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
                  <TrendingUp className="h-8 w-8 text-primary mb-3" />
                  <p className="text-sm leading-relaxed">{insights.progressForecast}</p>
                </div>

                <h4 className="font-medium mt-6">Clinical Notes</h4>
                <div className="p-4 rounded-lg border bg-muted/30">
                  <p className="text-sm text-muted-foreground italic">{insights.clinicalNotes}</p>
                </div>
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </CardContent>
    </Card>
  );
}
