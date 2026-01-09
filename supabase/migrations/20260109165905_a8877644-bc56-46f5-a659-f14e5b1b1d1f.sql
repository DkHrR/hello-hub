-- Add REMoDNaV metrics columns to eye_tracking_data
ALTER TABLE eye_tracking_data 
ADD COLUMN IF NOT EXISTS saccade_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pso_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS glissade_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS biomarkers JSONB DEFAULT '{}'::jsonb;

-- Add AI insights and biomarkers to assessment_results
ALTER TABLE assessment_results
ADD COLUMN IF NOT EXISTS ai_insights JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS dyslexia_biomarkers JSONB DEFAULT NULL;

-- Parent access tokens table for shareable progress reports
CREATE TABLE IF NOT EXISTS parent_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  access_code VARCHAR(8) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  included_assessments UUID[] DEFAULT ARRAY[]::UUID[],
  settings JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS for parent_access_tokens
ALTER TABLE parent_access_tokens ENABLE ROW LEVEL SECURITY;

-- Educators can manage their own access tokens
CREATE POLICY "Educators can create access tokens"
ON parent_access_tokens
FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Educators can view their access tokens"
ON parent_access_tokens
FOR SELECT
USING (created_by = auth.uid());

CREATE POLICY "Educators can update their access tokens"
ON parent_access_tokens
FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "Educators can delete their access tokens"
ON parent_access_tokens
FOR DELETE
USING (created_by = auth.uid());

-- Create index for access code lookups
CREATE INDEX IF NOT EXISTS idx_parent_access_tokens_code ON parent_access_tokens(access_code);
CREATE INDEX IF NOT EXISTS idx_parent_access_tokens_student ON parent_access_tokens(student_id);