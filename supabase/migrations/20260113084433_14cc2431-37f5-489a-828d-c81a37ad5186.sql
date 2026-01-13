-- Add CHECK constraints for input validation defense-in-depth
-- These constraints provide server-side validation as a backup to client-side Zod validation

-- Students table constraints
ALTER TABLE public.students
  ADD CONSTRAINT students_name_length CHECK (length(name) BETWEEN 1 AND 200),
  ADD CONSTRAINT students_age_range CHECK (age >= 3 AND age <= 25),
  ADD CONSTRAINT students_grade_length CHECK (length(grade) BETWEEN 1 AND 20),
  ADD CONSTRAINT students_risk_level_valid CHECK (risk_level IS NULL OR risk_level IN ('low', 'medium', 'moderate', 'high'));

-- Diagnostic results probability constraints (0 to 1 range)
ALTER TABLE public.diagnostic_results
  ADD CONSTRAINT check_dyslexia_probability_range 
    CHECK (dyslexia_probability_index IS NULL OR (dyslexia_probability_index >= 0 AND dyslexia_probability_index <= 1)),
  ADD CONSTRAINT check_adhd_probability_range 
    CHECK (adhd_probability_index IS NULL OR (adhd_probability_index >= 0 AND adhd_probability_index <= 1)),
  ADD CONSTRAINT check_dysgraphia_probability_range 
    CHECK (dysgraphia_probability_index IS NULL OR (dysgraphia_probability_index >= 0 AND dysgraphia_probability_index <= 1)),
  ADD CONSTRAINT check_overall_risk_level_valid 
    CHECK (overall_risk_level IS NULL OR overall_risk_level IN ('low', 'medium', 'moderate', 'high'));

-- Profiles table constraints
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_name_length CHECK (display_name IS NULL OR length(display_name) <= 100),
  ADD CONSTRAINT profiles_title_length CHECK (title IS NULL OR length(title) <= 50),
  ADD CONSTRAINT profiles_organization_length CHECK (organization IS NULL OR length(organization) <= 200);

-- Parent accounts constraints
ALTER TABLE public.parent_accounts
  ADD CONSTRAINT parent_accounts_display_name_length CHECK (display_name IS NULL OR length(display_name) <= 100),
  ADD CONSTRAINT parent_accounts_phone_length CHECK (phone IS NULL OR length(phone) <= 20);

-- Handwriting samples constraints
ALTER TABLE public.handwriting_samples
  ADD CONSTRAINT check_reversal_count_valid CHECK (reversal_count IS NULL OR reversal_count >= 0),
  ADD CONSTRAINT check_letter_crowding_range CHECK (letter_crowding IS NULL OR (letter_crowding >= 0 AND letter_crowding <= 1)),
  ADD CONSTRAINT check_graphic_inconsistency_range CHECK (graphic_inconsistency IS NULL OR (graphic_inconsistency >= 0 AND graphic_inconsistency <= 1)),
  ADD CONSTRAINT check_line_adherence_range CHECK (line_adherence IS NULL OR (line_adherence >= 0 AND line_adherence <= 1));