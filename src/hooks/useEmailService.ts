import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface SendEmailOptions {
  to: string;
  subject?: string;
  html?: string;
  type?: 'assessment_report' | 'welcome' | 'weekly_summary';
  assessmentId?: string;
  studentName?: string;
}

export function useEmailService() {
  const [isSending, setIsSending] = useState(false);

  const sendEmail = async (options: SendEmailOptions): Promise<boolean> => {
    setIsSending(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: options,
      });

      if (error) {
        throw error;
      }

      toast.success('Email sent successfully!');
      return true;
    } catch (error: any) {
      logger.error('Failed to send email', error);
      toast.error(logger.getUserMessage(error, 'Failed to send email'));
      return false;
    } finally {
      setIsSending(false);
    }
  };

  const sendAssessmentReport = async (
    recipientEmail: string,
    assessmentId: string,
    studentName: string
  ): Promise<boolean> => {
    return sendEmail({
      to: recipientEmail,
      type: 'assessment_report',
      assessmentId,
      studentName,
    });
  };

  const sendWelcomeEmail = async (
    recipientEmail: string,
    userName: string
  ): Promise<boolean> => {
    return sendEmail({
      to: recipientEmail,
      type: 'welcome',
      studentName: userName,
    });
  };

  const sendCustomEmail = async (
    to: string,
    subject: string,
    html: string
  ): Promise<boolean> => {
    return sendEmail({ to, subject, html });
  };

  return {
    isSending,
    sendEmail,
    sendAssessmentReport,
    sendWelcomeEmail,
    sendCustomEmail,
  };
}
