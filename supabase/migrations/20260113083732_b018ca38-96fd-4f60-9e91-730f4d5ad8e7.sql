-- Add DELETE policy for parent_accounts to allow parents to delete their own account
-- This enables GDPR compliance (right to erasure) and self-service account deletion

CREATE POLICY "Parents can delete their own account"
ON public.parent_accounts
FOR DELETE
USING (auth.uid() = user_id);