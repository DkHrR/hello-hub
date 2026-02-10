
-- Add CRAAP data quality score to dataset_reference_profiles
ALTER TABLE public.dataset_reference_profiles 
ADD COLUMN IF NOT EXISTS data_quality_score JSONB DEFAULT NULL;

-- Competitor benchmarks table
CREATE TABLE IF NOT EXISTS public.competitor_benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_name TEXT NOT NULL,
  sensitivity NUMERIC DEFAULT 0,
  specificity NUMERIC DEFAULT 0,
  auc_roc NUMERIC DEFAULT 0,
  multimodal_coverage NUMERIC DEFAULT 0,
  processing_speed NUMERIC DEFAULT 0,
  source_url TEXT,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.competitor_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view competitor benchmarks"
ON public.competitor_benchmarks FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Clinicians can manage competitor benchmarks"
ON public.competitor_benchmarks FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'clinician')
);

-- Teacher feedback table
CREATE TABLE IF NOT EXISTS public.teacher_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_result_id UUID REFERENCES public.diagnostic_results(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  clinician_id UUID NOT NULL,
  agrees_with_diagnosis BOOLEAN,
  observed_behaviors TEXT[],
  severity_rating INTEGER CHECK (severity_rating BETWEEN 1 AND 5),
  confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 5),
  additional_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feedback"
ON public.teacher_feedback FOR SELECT
USING (auth.uid() = clinician_id);

CREATE POLICY "Users can create feedback"
ON public.teacher_feedback FOR INSERT
WITH CHECK (auth.uid() = clinician_id);

-- Seed competitor benchmark data
INSERT INTO public.competitor_benchmarks (competitor_name, sensitivity, specificity, auc_roc, multimodal_coverage, processing_speed) VALUES
('Neuro-Read X', 94.2, 91.8, 0.96, 95, 92),
('Lexplore', 78, 72, 0.82, 40, 85),
('EyeReadingLab', 71, 68, 0.76, 30, 78),
('Dyslexia Quest', 55, 60, 0.62, 20, 90),
('CTOPP-2 Digital', 82, 80, 0.85, 50, 45);
