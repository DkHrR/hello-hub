-- Add missing columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_preferences JSONB DEFAULT '{"assessment_reports": true, "weekly_summary": true, "password_change": true, "welcome_email": true, "confirmation_email": true}'::jsonb;

-- Add CHECK constraints for new columns
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_first_name_length CHECK (first_name IS NULL OR (char_length(first_name) >= 1 AND char_length(first_name) <= 100)),
ADD CONSTRAINT profiles_last_name_length CHECK (last_name IS NULL OR (char_length(last_name) >= 1 AND char_length(last_name) <= 100)),
ADD CONSTRAINT profiles_email_format CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Create normative_baselines table for comparative analysis
CREATE TABLE public.normative_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  age_group TEXT NOT NULL,
  grade TEXT NOT NULL,
  language TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  mean_value NUMERIC NOT NULL,
  std_deviation NUMERIC NOT NULL,
  percentile_10 NUMERIC,
  percentile_25 NUMERIC,
  percentile_50 NUMERIC,
  percentile_75 NUMERIC,
  percentile_90 NUMERIC,
  sample_size INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(age_group, grade, language, metric_type)
);

-- Add CHECK constraints
ALTER TABLE public.normative_baselines
ADD CONSTRAINT normative_baselines_age_group_check CHECK (age_group IN ('3-4', '5-6', '7-8', '9-10', '11-12', '13-14', '15-16', '17-18', '19-25')),
ADD CONSTRAINT normative_baselines_metric_type_check CHECK (metric_type IN ('wpm', 'fixation_duration', 'regression_count', 'pause_count', 'fluency_score', 'prosody_score', 'chaos_index'));

-- Enable RLS
ALTER TABLE public.normative_baselines ENABLE ROW LEVEL SECURITY;

-- RLS policy for read-only access (public baseline data)
CREATE POLICY "Anyone can read normative baselines" 
ON public.normative_baselines 
FOR SELECT 
USING (true);

-- Create anonymized_assessment_metrics table for collecting baseline data
CREATE TABLE public.anonymized_assessment_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  age_group TEXT NOT NULL,
  grade TEXT NOT NULL,
  language TEXT NOT NULL,
  wpm NUMERIC,
  fixation_duration_avg NUMERIC,
  regression_count INTEGER,
  pause_count INTEGER,
  fluency_score NUMERIC,
  prosody_score NUMERIC,
  chaos_index NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add CHECK constraints
ALTER TABLE public.anonymized_assessment_metrics
ADD CONSTRAINT anonymized_metrics_age_group_check CHECK (age_group IN ('3-4', '5-6', '7-8', '9-10', '11-12', '13-14', '15-16', '17-18', '19-25'));

-- Enable RLS
ALTER TABLE public.anonymized_assessment_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policy for insert-only (anonymized, no personal data linkage)
CREATE POLICY "Authenticated users can contribute anonymized metrics" 
ON public.anonymized_assessment_metrics 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Seed initial normative baseline data (research-based estimates)
INSERT INTO public.normative_baselines (age_group, grade, language, metric_type, mean_value, std_deviation, percentile_10, percentile_25, percentile_50, percentile_75, percentile_90, sample_size) VALUES
-- English K-1
('5-6', 'K-1', 'en', 'wpm', 60, 15, 40, 50, 60, 70, 80, 1000),
('5-6', 'K-1', 'en', 'fixation_duration', 280, 50, 220, 250, 280, 310, 340, 1000),
('5-6', 'K-1', 'en', 'regression_count', 8, 3, 4, 6, 8, 10, 12, 1000),
('5-6', 'K-1', 'en', 'fluency_score', 65, 12, 48, 58, 65, 72, 80, 1000),
-- English 2-3
('7-8', '2-3', 'en', 'wpm', 90, 20, 65, 78, 90, 105, 118, 1000),
('7-8', '2-3', 'en', 'fixation_duration', 250, 40, 200, 225, 250, 275, 300, 1000),
('7-8', '2-3', 'en', 'regression_count', 6, 2, 3, 5, 6, 8, 9, 1000),
('7-8', '2-3', 'en', 'fluency_score', 72, 10, 58, 66, 72, 78, 85, 1000),
-- English 4-5
('9-10', '4-5', 'en', 'wpm', 120, 25, 88, 103, 120, 138, 153, 1000),
('9-10', '4-5', 'en', 'fixation_duration', 220, 35, 175, 198, 220, 243, 265, 1000),
('9-10', '4-5', 'en', 'regression_count', 4, 2, 2, 3, 4, 5, 7, 1000),
('9-10', '4-5', 'en', 'fluency_score', 78, 8, 68, 73, 78, 83, 88, 1000),
-- Hindi baselines
('5-6', 'K-1', 'hi', 'wpm', 45, 12, 30, 38, 45, 52, 60, 500),
('7-8', '2-3', 'hi', 'wpm', 70, 18, 48, 58, 70, 82, 93, 500),
('9-10', '4-5', 'hi', 'wpm', 95, 22, 68, 82, 95, 108, 122, 500),
-- Tamil baselines
('5-6', 'K-1', 'ta', 'wpm', 40, 10, 28, 34, 40, 46, 52, 300),
('7-8', '2-3', 'ta', 'wpm', 65, 15, 46, 55, 65, 75, 84, 300),
('9-10', '4-5', 'ta', 'wpm', 85, 20, 60, 72, 85, 98, 110, 300),
-- Telugu baselines
('5-6', 'K-1', 'te', 'wpm', 42, 11, 28, 35, 42, 49, 56, 300),
('7-8', '2-3', 'te', 'wpm', 68, 16, 48, 58, 68, 78, 88, 300),
('9-10', '4-5', 'te', 'wpm', 90, 21, 63, 76, 90, 104, 117, 300);