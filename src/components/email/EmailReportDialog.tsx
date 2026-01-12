import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEmailService } from '@/hooks/useEmailService';
import { Mail, Loader2 } from 'lucide-react';

interface EmailReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentId: string;
  studentName: string;
  defaultEmail?: string;
}

export function EmailReportDialog({
  open,
  onOpenChange,
  assessmentId,
  studentName,
  defaultEmail = '',
}: EmailReportDialogProps) {
  const [email, setEmail] = useState(defaultEmail);
  const { isSending, sendAssessmentReport } = useEmailService();

  const handleSend = async () => {
    if (!email) return;
    
    const success = await sendAssessmentReport(email, assessmentId, studentName);
    if (success) {
      onOpenChange(false);
      setEmail('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Email Assessment Report
          </DialogTitle>
          <DialogDescription>
            Send the assessment report for {studentName} to a parent or guardian.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Recipient Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="parent@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!email || isSending}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
