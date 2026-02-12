
-- Fix audit log privacy: restrict cross-account access
-- Drop the overly permissive clinician policy
DROP POLICY IF EXISTS "Clinicians can view all audit logs for threat detection" ON public.verification_audit_log;

-- The existing "Users can view their own audit logs" policy already exists and is sufficient
