/**
 * Parent Access Hook
 * Manages shareable access codes for parent portal
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ParentAccessToken {
  id: string;
  student_id: string;
  access_code: string;
  expires_at: string;
  created_at: string;
  last_accessed_at: string | null;
  access_count: number;
  included_assessments: string[];
  settings: Record<string, unknown>;
}

interface CreateTokenParams {
  studentId: string;
  expiresInDays: number;
  includedAssessments?: string[];
  settings?: Record<string, unknown>;
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

  const createToken = useCallback(async ({
    studentId,
    expiresInDays,
    includedAssessments = [],
    settings = {},
  }: CreateTokenParams): Promise<ParentAccessToken | null> => {
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
          expires_at: expiresAt.toISOString(),
          created_by: user.id,
          included_assessments: includedAssessments,
          settings: settings as any,
        } as any)
        .select()
        .single();

      if (insertError) throw insertError;

      toast({
        title: 'Access code created',
        description: `Share this code with parents: ${accessCode}`,
      });

      return data as ParentAccessToken;
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
      setTokens((data as ParentAccessToken[]) || []);
    } catch (err) {
      console.error('Error fetching tokens:', err);
      setTokens([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const revokeToken = useCallback(async (tokenId: string) => {
    try {
      const { error } = await supabase
        .from('parent_access_tokens')
        .delete()
        .eq('id', tokenId);

      if (error) throw error;

      setTokens(prev => prev.filter(t => t.id !== tokenId));
      toast({ title: 'Access code revoked' });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to revoke access code',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const validateAccessCode = useCallback(async (code: string): Promise<{
    valid: boolean;
    studentId?: string;
    expired?: boolean;
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
      console.error('Error fetching portal data:', err);
      return null;
    }
  }, []);

  const getShareableUrl = useCallback((accessCode: string): string => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/parent-portal?code=${accessCode}`;
  }, []);

  return {
    tokens,
    isLoading,
    error,
    createToken,
    fetchTokensForStudent,
    revokeToken,
    validateAccessCode,
    getPortalData,
    getShareableUrl,
    generateAccessCode,
  };
}
