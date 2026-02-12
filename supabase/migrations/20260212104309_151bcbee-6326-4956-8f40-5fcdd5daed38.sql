
-- Create audit log table for sensitive data access (students/minors)
CREATE TABLE IF NOT EXISTS public.sensitive_data_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sensitive_data_access_log ENABLE ROW LEVEL SECURITY;

-- No client access - only server-side (triggers) can write
CREATE POLICY "Deny all client access to sensitive data access log"
  ON public.sensitive_data_access_log
  AS RESTRICTIVE
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Trigger function to log access to students table
CREATE OR REPLACE FUNCTION public.log_student_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sensitive_data_access_log (user_id, table_name, record_id, action)
  VALUES (auth.uid(), 'students', COALESCE(NEW.id, OLD.id), TG_OP);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach triggers for INSERT, UPDATE, DELETE on students
CREATE TRIGGER audit_student_insert
  AFTER INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.log_student_data_access();

CREATE TRIGGER audit_student_update
  AFTER UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.log_student_data_access();

CREATE TRIGGER audit_student_delete
  AFTER DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.log_student_data_access();
