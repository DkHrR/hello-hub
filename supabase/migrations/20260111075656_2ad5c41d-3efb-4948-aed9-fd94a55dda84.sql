-- Fix profile exposure vulnerability: restrict SELECT to owner only
-- Drop the overly permissive "Users can view all profiles" policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create new owner-only SELECT policy
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);