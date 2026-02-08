-- Allow clinicians to view all audit logs for cross-account threat detection
CREATE POLICY "Clinicians can view all audit logs for threat detection"
ON public.verification_audit_log
FOR SELECT
USING (public.has_role(auth.uid(), 'clinician'));