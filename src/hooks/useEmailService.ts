import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface SendEmailOptions {
  to: string;
  subject?: string;
  html?: string;
  type?: 'assessment_report' | 'welcome' | 'weekly_summary' | 'password_change' | 'confirmation';
  assessmentId?: string;
  studentName?: string;
  userName?: string;
}

export function useEmailService() {
  const [isSending, setIsSending] = useState(false);

  const sendEmail = useCallback(async (options: SendEmailOptions): Promise<boolean> => {
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
  }, []);

  const sendAssessmentReport = useCallback(async (
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
  }, [sendEmail]);

  const sendWelcomeEmail = useCallback(async (
    recipientEmail: string,
    userName: string
  ): Promise<boolean> => {
    return sendEmail({
      to: recipientEmail,
      type: 'welcome',
      studentName: userName,
    });
  }, [sendEmail]);

  const sendCustomEmail = useCallback(async (
    to: string,
    subject: string,
    html: string
  ): Promise<boolean> => {
    return sendEmail({ to, subject, html });
  }, [sendEmail]);

  return {
    isSending,
    sendEmail,
    sendAssessmentReport,
    sendWelcomeEmail,
    sendCustomEmail,
  };
}
