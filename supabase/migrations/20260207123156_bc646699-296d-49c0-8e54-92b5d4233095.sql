
-- Fix overly permissive RLS on dataset_computed_thresholds
-- Drop the permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert thresholds" ON public.dataset_computed_thresholds;
DROP POLICY IF EXISTS "Authenticated users can update thresholds" ON public.dataset_computed_thresholds;
DROP POLICY IF EXISTS "Authenticated users can delete thresholds" ON public.dataset_computed_thresholds;

-- Only allow clinicians to write thresholds (they upload datasets)
CREATE POLICY "Clinicians can insert thresholds"
ON public.dataset_computed_thresholds
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'clinician'
  )
);

CREATE POLICY "Clinicians can update thresholds"
ON public.dataset_computed_thresholds
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'clinician'
  )
);

CREATE POLICY "Clinicians can delete thresholds"
ON public.dataset_computed_thresholds
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'clinician'
  )
);
