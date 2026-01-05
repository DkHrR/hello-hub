import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { useHandwritingAnalysis } from '@/hooks/useHandwritingAnalysis';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { HandwritingMetrics } from '@/types/diagnostic';
import logger from '@/lib/logger';
import { 
  Upload, 
  FileImage, 
  AlertTriangle, 
  CheckCircle,
  RotateCcw,
  Loader2,
  PenTool
} from 'lucide-react';

interface HandwritingUploadProps {
  onAnalysisComplete: (metrics: HandwritingMetrics) => void;
}

export function HandwritingUpload({ onAnalysisComplete }: HandwritingUploadProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<HandwritingMetrics | null>(null);
  
  const { 
    isAnalyzing, 
    progress, 
    recognizedText, 
    characterAnalysis, 
    analyzeImage, 
    reset 
  } = useHandwritingAnalysis();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setSelectedImage(imageUrl);
      
      try {
        const result = await analyzeImage(file);
        setMetrics(result);
        onAnalysisComplete(result);
      } catch (error) {
        logger.error('Handwriting analysis failed', error);
      }
    }
  }, [analyzeImage, onAnalysisComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.bmp']
    },
    maxFiles: 1,
    disabled: isAnalyzing
  });

  const handleReset = () => {
    reset();
    setSelectedImage(null);
    setMetrics(null);
  };

  const getScoreColor = (score: number, inverted = false) => {
    const value = inverted ? 1 - score : score;
    if (value > 0.6) return 'text-destructive';
    if (value > 0.3) return 'text-warning';
    return 'text-success';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PenTool className="w-5 h-5 text-primary" />
          Handwriting Analysis (OCR)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!selectedImage ? (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
              transition-all duration-200
              ${isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }
            `}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">
              {isDragActive ? 'Drop the image here' : 'Upload Handwriting Sample'}
            </p>
            <p className="text-sm text-muted-foreground">
              Drag & drop or click to select a scanned handwriting image
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Supports PNG, JPG, WEBP (Max 10MB)
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Image Preview */}
            <div className="relative rounded-lg overflow-hidden border border-border">
              <img 
                src={selectedImage} 
                alt="Handwriting sample" 
                className="w-full max-h-64 object-contain bg-muted"
              />
              {isAnalyzing && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-sm font-medium">Analyzing handwriting...</p>
                    <Progress value={progress} className="w-48 mt-2" />
                  </div>
                </div>
              )}
            </div>

            {/* Results */}
            {metrics && !isAnalyzing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Recognized Text */}
                {recognizedText && (
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium mb-2">Recognized Text:</p>
                    <p className="text-sm text-muted-foreground italic">
                      "{recognizedText.slice(0, 200)}{recognizedText.length > 200 ? '...' : ''}"
                    </p>
                  </div>
                )}

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Character Reversals</span>
                      {metrics.reversalCount > 0 ? (
                        <AlertTriangle className="w-4 h-4 text-warning" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-success" />
                      )}
                    </div>
                    <p className={`text-2xl font-bold ${metrics.reversalCount > 2 ? 'text-destructive' : metrics.reversalCount > 0 ? 'text-warning' : 'text-success'}`}>
                      {metrics.reversalCount}
                    </p>
                    <p className="text-xs text-muted-foreground">b↔d, p↔q detected</p>
                  </div>

                  <div className="p-4 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Letter Crowding</span>
                    </div>
                    <p className={`text-2xl font-bold ${getScoreColor(metrics.letterCrowding)}`}>
                      {Math.round(metrics.letterCrowding * 100)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Spacing analysis</p>
                  </div>

                  <div className="p-4 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Graphic Inconsistency</span>
                    </div>
                    <p className={`text-2xl font-bold ${getScoreColor(metrics.graphicInconsistency)}`}>
                      {Math.round(metrics.graphicInconsistency * 100)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Letter formation variance</p>
                  </div>

                  <div className="p-4 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Line Adherence</span>
                    </div>
                    <p className={`text-2xl font-bold ${getScoreColor(metrics.lineAdherence, true)}`}>
                      {Math.round(metrics.lineAdherence * 100)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Baseline consistency</p>
                  </div>
                </div>

                {/* Detected Reversals */}
                {characterAnalysis && characterAnalysis.reversals.length > 0 && (
                  <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-warning" />
                      Detected Reversals
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {characterAnalysis.reversals.map((rev, i) => (
                        <Badge key={i} variant="outline" className="text-warning border-warning/50">
                          {rev.char}: {rev.context}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            <Button 
              variant="outline" 
              onClick={handleReset}
              disabled={isAnalyzing}
              className="w-full"
            >
              <RotateCcw className="w-4 h-4" />
              Analyze Another Sample
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
