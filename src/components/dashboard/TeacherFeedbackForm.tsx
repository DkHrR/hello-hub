import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ClipboardCheck, Loader2, Star } from 'lucide-react';

interface TeacherFeedbackFormProps {
  diagnosticResultId: string;
  studentId: string;
  riskLevel?: string;
  onSubmitted?: () => void;
}

const BEHAVIOR_OPTIONS = [
  'Letter reversals (b/d, p/q)',
  'Slow reading speed',
  'Difficulty with phonemic awareness',
  'Poor reading comprehension',
  'Avoidance of reading tasks',
  'Inconsistent spelling',
  'Difficulty tracking lines',
  'Loses place while reading',
  'Difficulty with word retrieval',
  'Strong verbal skills despite reading difficulty',
];

export function TeacherFeedbackForm({ diagnosticResultId, studentId, riskLevel, onSubmitted }: TeacherFeedbackFormProps) {
  const { user } = useAuth();
  const [agreesWithDiagnosis, setAgreesWithDiagnosis] = useState<boolean | null>(null);
  const [selectedBehaviors, setSelectedBehaviors] = useState<string[]>([]);
  const [severityRating, setSeverityRating] = useState([3]);
  const [confidenceLevel, setConfidenceLevel] = useState([3]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggleBehavior = (behavior: string) => {
    setSelectedBehaviors(prev =>
      prev.includes(behavior) ? prev.filter(b => b !== behavior) : [...prev, behavior]
    );
  };

  const handleSubmit = async () => {
    if (!user || agreesWithDiagnosis === null) {
      toast.error('Please indicate whether you agree with the diagnosis.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.from('teacher_feedback').insert({
      diagnostic_result_id: diagnosticResultId,
      student_id: studentId,
      clinician_id: user.id,
      agrees_with_diagnosis: agreesWithDiagnosis,
      observed_behaviors: selectedBehaviors,
      severity_rating: severityRating[0],
      confidence_level: confidenceLevel[0],
      additional_notes: notes || null,
    } as any);

    setIsSubmitting(false);
    if (error) {
      toast.error('Failed to submit feedback.');
    } else {
      toast.success('Clinical feedback submitted! This strengthens diagnostic confidence.');
      onSubmitted?.();
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          Clinical Consensus Feedback
        </CardTitle>
        <CardDescription>
          Your observations strengthen our diagnostic confidence score
          {riskLevel && (
            <Badge variant="outline" className="ml-2">{riskLevel} risk</Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Agreement */}
        <div className="space-y-2">
          <Label>Do you agree with the AI diagnostic assessment?</Label>
          <div className="flex gap-2">
            <Button
              variant={agreesWithDiagnosis === true ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAgreesWithDiagnosis(true)}
            >
              Yes, Agree
            </Button>
            <Button
              variant={agreesWithDiagnosis === false ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setAgreesWithDiagnosis(false)}
            >
              No, Disagree
            </Button>
          </div>
        </div>

        {/* Observed Behaviors */}
        <div className="space-y-2">
          <Label>Observed Behaviors (select all that apply)</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {BEHAVIOR_OPTIONS.map(behavior => (
              <div key={behavior} className="flex items-center gap-2">
                <Checkbox
                  checked={selectedBehaviors.includes(behavior)}
                  onCheckedChange={() => handleToggleBehavior(behavior)}
                />
                <span className="text-sm">{behavior}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Severity */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            Perceived Severity
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} className={`w-3 h-3 ${i <= severityRating[0] ? 'fill-primary text-primary' : 'text-muted'}`} />
              ))}
            </div>
          </Label>
          <Slider value={severityRating} onValueChange={setSeverityRating} min={1} max={5} step={1} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Mild</span><span>Moderate</span><span>Severe</span>
          </div>
        </div>

        {/* Confidence */}
        <div className="space-y-2">
          <Label>Your Confidence Level</Label>
          <Slider value={confidenceLevel} onValueChange={setConfidenceLevel} min={1} max={5} step={1} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Low</span><span>Medium</span><span>High</span>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label>Additional Observations</Label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any additional clinical observations..."
            rows={3}
          />
        </div>

        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ClipboardCheck className="w-4 h-4 mr-2" />}
          Submit Clinical Feedback
        </Button>
      </CardContent>
    </Card>
  );
}
