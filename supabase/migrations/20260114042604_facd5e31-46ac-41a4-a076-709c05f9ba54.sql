-- Add UPDATE and DELETE policies to assessment_results table for data correction capability
-- This allows clinicians to correct data entry errors without recreating entire assessments

-- Policy for UPDATE: Users can update results for their own assessments
CREATE POLICY "Users can update results for their assessments"
ON public.assessment_results FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.assessments
    WHERE assessments.id = assessment_results.assessment_id
    AND assessments.assessor_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.assessments
    WHERE assessments.id = assessment_results.assessment_id
    AND assessments.assessor_id = auth.uid()
  )
);

-- Policy for DELETE: Users can delete results for their own assessments
CREATE POLICY "Users can delete results for their assessments"
ON public.assessment_results FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.assessments
    WHERE assessments.id = assessment_results.assessment_id
    AND assessments.assessor_id = auth.uid()
  )
);