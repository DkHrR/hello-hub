/**
 * Parent Access Hook
 * Manages parent portal access via parent_student_links table
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface ParentStudentLink {
  id: string;
  student_id: string;
  access_code: string;
  parent_id: string | null;
  linked_at: string;
  linked_by: string;
}

interface CreateLinkParams {
  studentId: string;
}

export function useParentAccess() {
  const { toast } = useToast();
  const [links, setLinks] = useState<ParentStudentLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAccessCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0, O, 1, I
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const createLink = useCallback(async ({
    studentId,
  }: CreateLinkParams): Promise<ParentStudentLink | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const accessCode = generateAccessCode();

      const { data, error: insertError } = await supabase
        .from('parent_student_links')
        .insert({
          student_id: studentId,
          access_code: accessCode,
          linked_by: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast({
        title: 'Access code created',
        description: `Share this code with parents: ${accessCode}`,
      });

      return data as ParentStudentLink;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create access code';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchLinksForStudent = useCallback(async (studentId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('parent_student_links')
        .select('*')
        .eq('student_id', studentId)
        .order('linked_at', { ascending: false });

      if (error) throw error;
      setLinks((data as ParentStudentLink[]) || []);
    } catch (err) {
      logger.error('Error fetching links', err);
      setLinks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const validateAccessCode = useCallback(async (code: string): Promise<{
    valid: boolean;
    studentId?: string;
  }> => {
    try {
      const { data, error } = await supabase.functions.invoke('parent-portal-access', {
        body: { accessCode: code, action: 'validate' },
      });

      if (error) throw error;
      return data;
    } catch {
      return { valid: false };
    }
  }, []);

  const getPortalData = useCallback(async (accessCode: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('parent-portal-access', {
        body: { accessCode, action: 'getData' },
      });

      if (error) throw error;
      return data;
    } catch (err) {
      logger.error('Error fetching portal data', err);
      return null;
    }
  }, []);

  const getShareableUrl = useCallback((accessCode: string): string => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/parent-portal?code=${accessCode}`;
  }, []);

  return {
    links,
    isLoading,
    error,
    createLink,
    fetchLinksForStudent,
    validateAccessCode,
    getPortalData,
    getShareableUrl,
    generateAccessCode,
  };
}
