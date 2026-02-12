
-- Create the get_assessment_count function for live counter
CREATE OR REPLACE FUNCTION public.get_assessment_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) FROM public.diagnostic_results;
$$;
