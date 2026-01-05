import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { DiagnosticResult, EyeTrackingMetrics, VoiceMetrics, HandwritingMetrics } from '@/types/diagnostic';
import logger from '@/lib/logger';
import { 
  FileText, 
  Download, 
  Loader2,
  Eye,
  Mic,
  PenTool,
  Brain,
  Calendar,
  User
} from 'lucide-react';

interface PDFReportGeneratorProps {
  studentName: string;
  studentAge: number;
  studentGrade: string;
  eyeMetrics: EyeTrackingMetrics | null;
  voiceMetrics: VoiceMetrics | null;
  handwritingMetrics: HandwritingMetrics | null;
  dyslexiaIndex: number;
  adhdIndex: number;
  dysgraphiaIndex: number;
  overallRisk: 'low' | 'moderate' | 'high';
  gazeHeatmapRef?: React.RefObject<HTMLCanvasElement>;
}

export function PDFReportGenerator({
  studentName,
  studentAge,
  studentGrade,
  eyeMetrics,
  voiceMetrics,
  handwritingMetrics,
  dyslexiaIndex,
  adhdIndex,
  dysgraphiaIndex,
  overallRisk,
  gazeHeatmapRef
}: PDFReportGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const reportContentRef = useRef<HTMLDivElement>(null);

  const generatePDF = async () => {
    setIsGenerating(true);
    setProgress(10);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;

      // Header
      pdf.setFillColor(30, 41, 59); // Dark blue
      pdf.rect(0, 0, pageWidth, 40, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Neuro-Read X Platinum', margin, 20);
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Clinical Diagnostic Report', margin, 30);
      
      pdf.setFontSize(10);
      pdf.text(`Generated: ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`, pageWidth - margin - 60, 30);

      setProgress(20);
      yPos = 50;

      // Student Information
      pdf.setTextColor(30, 41, 59);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Student Information', margin, yPos);
      yPos += 8;

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Name: ${studentName}`, margin, yPos);
      pdf.text(`Age: ${studentAge} years`, margin + 80, yPos);
      pdf.text(`Grade: ${studentGrade}`, margin + 130, yPos);
      yPos += 15;

      setProgress(30);

      // Risk Summary Box
      const riskColor = overallRisk === 'high' ? [239, 68, 68] : overallRisk === 'moderate' ? [245, 158, 11] : [34, 197, 94];
      pdf.setFillColor(riskColor[0], riskColor[1], riskColor[2]);
      pdf.roundedRect(margin, yPos, pageWidth - 2 * margin, 25, 3, 3, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Overall Risk Level: ${overallRisk.toUpperCase()}`, margin + 5, yPos + 10);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Dyslexia: ${dyslexiaIndex.toFixed(1)}%  |  ADHD: ${adhdIndex.toFixed(1)}%  |  Dysgraphia: ${dysgraphiaIndex.toFixed(1)}%`, margin + 5, yPos + 18);
      yPos += 35;

      setProgress(40);

      // Eye Tracking Metrics
      pdf.setTextColor(30, 41, 59);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Ocular Biometrics Analysis', margin, yPos);
      yPos += 8;

      if (eyeMetrics) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        
        const eyeData = [
          ['Total Fixations', eyeMetrics.totalFixations.toString()],
          ['Avg Fixation Duration', `${eyeMetrics.averageFixationDuration.toFixed(0)}ms`],
          ['Saccadic Regressions', eyeMetrics.regressionCount.toString()],
          ['Prolonged Fixations (>400ms)', eyeMetrics.prolongedFixations.toString()],
          ['Chaos Index', (eyeMetrics.chaosIndex * 100).toFixed(1) + '%'],
          ['Fixation Intersection Coefficient', (eyeMetrics.fixationIntersectionCoefficient * 100).toFixed(1) + '%']
        ];

        eyeData.forEach(([label, value]) => {
          pdf.text(`• ${label}: ${value}`, margin + 5, yPos);
          yPos += 6;
        });
      } else {
        pdf.setFontSize(10);
        pdf.text('No eye tracking data available', margin + 5, yPos);
        yPos += 6;
      }
      yPos += 10;

      setProgress(55);

      // Voice Metrics
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Phonological Voice Analysis', margin, yPos);
      yPos += 8;

      if (voiceMetrics) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        
        const voiceData = [
          ['Reading Speed', `${voiceMetrics.wordsPerMinute} WPM`],
          ['Pause Count', voiceMetrics.pauseCount.toString()],
          ['Avg Pause Duration', `${voiceMetrics.averagePauseDuration}ms`],
          ['Phonemic Errors', voiceMetrics.phonemicErrors.toString()],
          ['Fluency Score', `${voiceMetrics.fluencyScore}/100`],
          ['Prosody Score', `${voiceMetrics.prosodyScore}/100`]
        ];

        voiceData.forEach(([label, value]) => {
          pdf.text(`• ${label}: ${value}`, margin + 5, yPos);
          yPos += 6;
        });
      } else {
        pdf.setFontSize(10);
        pdf.text('No voice analysis data available', margin + 5, yPos);
        yPos += 6;
      }
      yPos += 10;

      setProgress(70);

      // Check if we need a new page
      if (yPos > pageHeight - 80) {
        pdf.addPage();
        yPos = margin;
      }

      // Handwriting Metrics
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Graphomotor Assessment', margin, yPos);
      yPos += 8;

      if (handwritingMetrics) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        
        const handData = [
          ['Character Reversals (b↔d, p↔q)', handwritingMetrics.reversalCount.toString()],
          ['Letter Crowding Index', `${(handwritingMetrics.letterCrowding * 100).toFixed(1)}%`],
          ['Graphic Inconsistency', `${(handwritingMetrics.graphicInconsistency * 100).toFixed(1)}%`],
          ['Line Adherence', `${(handwritingMetrics.lineAdherence * 100).toFixed(1)}%`]
        ];

        handData.forEach(([label, value]) => {
          pdf.text(`• ${label}: ${value}`, margin + 5, yPos);
          yPos += 6;
        });
      } else {
        pdf.setFontSize(10);
        pdf.text('No handwriting analysis data available', margin + 5, yPos);
        yPos += 6;
      }
      yPos += 15;

      setProgress(85);

      // Capture and add gaze heatmap if available
      if (gazeHeatmapRef?.current) {
        try {
          const canvas = await html2canvas(gazeHeatmapRef.current);
          const imgData = canvas.toDataURL('image/png');
          
          // Check if we need a new page
          if (yPos > pageHeight - 80) {
            pdf.addPage();
            yPos = margin;
          }
          
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Gaze Heatmap Visualization', margin, yPos);
          yPos += 10;
          
          const imgWidth = pageWidth - 2 * margin;
          const imgHeight = (canvas.height / canvas.width) * imgWidth;
          pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, Math.min(imgHeight, 80));
          yPos += Math.min(imgHeight, 80) + 10;
        } catch (error) {
          logger.error('Failed to capture heatmap', error);
        }
      }

      setProgress(95);

      // Clinical Notes Section
      if (yPos > pageHeight - 50) {
        pdf.addPage();
        yPos = margin;
      }

      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Clinical Recommendations', margin, yPos);
      yPos += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      const recommendations = getRecommendations(dyslexiaIndex, adhdIndex, dysgraphiaIndex, overallRisk);
      recommendations.forEach((rec, i) => {
        pdf.text(`${i + 1}. ${rec}`, margin + 5, yPos);
        yPos += 6;
      });

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        'This report is generated by Neuro-Read X Platinum and is intended for clinical reference only.',
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
      pdf.text(
        'Please consult with qualified professionals for formal diagnosis.',
        pageWidth / 2,
        pageHeight - 5,
        { align: 'center' }
      );

      setProgress(100);

      // Save the PDF
      pdf.save(`NeuroRead_Report_${studentName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (error) {
      logger.error('PDF generation failed', error);
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const getRecommendations = (
    dyslexia: number, 
    adhd: number, 
    dysgraphia: number, 
    risk: 'low' | 'moderate' | 'high'
  ): string[] => {
    const recs: string[] = [];
    
    if (risk === 'high') {
      recs.push('Immediate referral to a learning disabilities specialist recommended.');
    }
    
    if (dyslexia > 50) {
      recs.push('Consider structured literacy intervention (Orton-Gillingham approach).');
      recs.push('Implement dyslexia-friendly accommodations: larger fonts, colored overlays.');
    }
    
    if (adhd > 50) {
      recs.push('Evaluate for attention-related interventions and classroom accommodations.');
      recs.push('Consider movement breaks and attention-focusing strategies.');
    }
    
    if (dysgraphia > 50) {
      recs.push('Occupational therapy assessment for fine motor skills recommended.');
      recs.push('Consider assistive technology for written expression.');
    }
    
    if (recs.length === 0) {
      recs.push('Continue monitoring and regular assessments.');
      recs.push('Maintain supportive learning environment.');
    }
    
    return recs;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Clinical Report Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span>{studentName || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>Age: {studentAge || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-muted-foreground" />
            <span>Grade: {studentGrade || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              overallRisk === 'high' ? 'bg-destructive/10 text-destructive' :
              overallRisk === 'moderate' ? 'bg-warning/10 text-warning' :
              'bg-success/10 text-success'
            }`}>
              {overallRisk.toUpperCase()} RISK
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-lg border border-border text-center">
            <Eye className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xs text-muted-foreground">Eye Tracking</p>
            <p className={`font-bold ${eyeMetrics ? 'text-success' : 'text-muted-foreground'}`}>
              {eyeMetrics ? '✓ Captured' : 'Pending'}
            </p>
          </div>
          <div className="p-3 rounded-lg border border-border text-center">
            <Mic className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xs text-muted-foreground">Voice Analysis</p>
            <p className={`font-bold ${voiceMetrics ? 'text-success' : 'text-muted-foreground'}`}>
              {voiceMetrics ? '✓ Captured' : 'Pending'}
            </p>
          </div>
          <div className="p-3 rounded-lg border border-border text-center">
            <PenTool className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xs text-muted-foreground">Handwriting</p>
            <p className={`font-bold ${handwritingMetrics ? 'text-success' : 'text-muted-foreground'}`}>
              {handwritingMetrics ? '✓ Captured' : 'Pending'}
            </p>
          </div>
        </div>

        {isGenerating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Generating report...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        <Button 
          onClick={generatePDF} 
          disabled={isGenerating}
          className="w-full"
          variant="hero"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Generate Clinical Report (PDF)
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
