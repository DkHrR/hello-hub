/**
 * Parent Access Hook
 * Manages parent portal access via parent_access_tokens table
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import type { Tables } from '@/integrations/supabase/types';

type ParentAccessToken = Tables<'parent_access_tokens'>;

interface CreateLinkParams {
  studentId: string;
  expiresInDays?: number;
}

export function useParentAccess() {
  const { toast } = useToast();
  const [tokens, setTokens] = useState<ParentAccessToken[]>([]);
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
    expiresInDays = 30,
  }: CreateLinkParams): Promise<ParentAccessToken | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const accessCode = generateAccessCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const { data, error: insertError } = await supabase
        .from('parent_access_tokens')
        .insert({
          student_id: studentId,
          access_code: accessCode,
          created_by: user.id,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast({
        title: 'Access code created',
        description: `Share this code with parents: ${accessCode}`,
      });

      return data;
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

  const fetchTokensForStudent = useCallback(async (studentId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('parent_access_tokens')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTokens(data || []);
    } catch (err) {
      logger.error('Error fetching tokens', err);
      setTokens([]);
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

  const revokeToken = useCallback(async (tokenId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('parent_access_tokens')
        .delete()
        .eq('id', tokenId);

      if (error) throw error;

      toast({
        title: 'Access revoked',
        description: 'The parent access code has been revoked.',
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revoke access';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  return {
    tokens,
    isLoading,
    error,
    createLink,
    fetchTokensForStudent,
    validateAccessCode,
    getPortalData,
    getShareableUrl,
    generateAccessCode,
    revokeToken,
  };
}