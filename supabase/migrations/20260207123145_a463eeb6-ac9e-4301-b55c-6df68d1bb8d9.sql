
-- Create dataset_reference_profiles table
CREATE TABLE public.dataset_reference_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_type TEXT NOT NULL CHECK (dataset_type IN ('dyslexia', 'adhd', 'dysgraphia')),
  subject_label TEXT NOT NULL,
  is_positive BOOLEAN NOT NULL DEFAULT false,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_upload_id UUID REFERENCES public.chunked_uploads(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dataset_reference_profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read reference profiles (shared reference data)
CREATE POLICY "Authenticated users can read reference profiles"
ON public.dataset_reference_profiles
FOR SELECT
TO authenticated
USING (true);

-- Users can insert their own profiles
CREATE POLICY "Users can insert their own reference profiles"
ON public.dataset_reference_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

-- Users can update their own profiles
CREATE POLICY "Users can update their own reference profiles"
ON public.dataset_reference_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = uploaded_by);

-- Users can delete their own profiles
CREATE POLICY "Users can delete their own reference profiles"
ON public.dataset_reference_profiles
FOR DELETE
TO authenticated
USING (auth.uid() = uploaded_by);

-- Create index for faster lookups
CREATE INDEX idx_reference_profiles_dataset_type ON public.dataset_reference_profiles(dataset_type);
CREATE INDEX idx_reference_profiles_uploaded_by ON public.dataset_reference_profiles(uploaded_by);

-- Create dataset_computed_thresholds table
CREATE TABLE public.dataset_computed_thresholds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_type TEXT NOT NULL CHECK (dataset_type IN ('dyslexia', 'adhd', 'dysgraphia')),
  metric_name TEXT NOT NULL,
  positive_mean NUMERIC NOT NULL DEFAULT 0,
  positive_std NUMERIC NOT NULL DEFAULT 0,
  negative_mean NUMERIC NOT NULL DEFAULT 0,
  negative_std NUMERIC NOT NULL DEFAULT 0,
  optimal_threshold NUMERIC NOT NULL DEFAULT 0,
  weight NUMERIC NOT NULL DEFAULT 1,
  sample_size_positive INTEGER NOT NULL DEFAULT 0,
  sample_size_negative INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(dataset_type, metric_name)
);

-- Enable RLS
ALTER TABLE public.dataset_computed_thresholds ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read computed thresholds
CREATE POLICY "Authenticated users can read computed thresholds"
ON public.dataset_computed_thresholds
FOR SELECT
TO authenticated
USING (true);

-- Service role writes thresholds via edge function, so we allow insert/update/delete for authenticated
-- The edge function uses service role key which bypasses RLS
-- But we also allow authenticated users to manage thresholds they computed
CREATE POLICY "Authenticated users can insert thresholds"
ON public.dataset_computed_thresholds
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update thresholds"
ON public.dataset_computed_thresholds
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete thresholds"
ON public.dataset_computed_thresholds
FOR DELETE
TO authenticated
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_computed_thresholds_dataset_type ON public.dataset_computed_thresholds(dataset_type);
