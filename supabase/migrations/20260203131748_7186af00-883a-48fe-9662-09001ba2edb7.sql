-- Fix 1: Restrict anonymized_assessment_metrics inserts to clinicians only
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can contribute anonymized metrics" ON anonymized_assessment_metrics;

-- Create a new restrictive policy that only allows clinicians to contribute metrics
CREATE POLICY "Only clinicians can contribute anonymized metrics"
ON anonymized_assessment_metrics
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'clinician'
  )
);

-- Fix 2: Ensure handwriting_samples storage bucket has proper RLS policies
-- First, ensure the bucket policies protect file access independently of table RLS

-- Create storage policy for clinicians to view their own uploaded files
CREATE POLICY "Clinicians can view their own handwriting files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'handwriting-samples'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create storage policy for clinicians to upload their own files
CREATE POLICY "Clinicians can upload handwriting files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'handwriting-samples'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create storage policy for clinicians to update their own files
CREATE POLICY "Clinicians can update their handwriting files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'handwriting-samples'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create storage policy for clinicians to delete their own files
CREATE POLICY "Clinicians can delete their handwriting files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'handwriting-samples'
  AND auth.uid()::text = (storage.foldername(name))[1]
);