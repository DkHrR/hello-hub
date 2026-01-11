-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('clinician', 'educator', 'parent', 'individual');

-- Create user_roles table for proper role-based access control
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable Row-Level Security on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get all roles for a user
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS app_role[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(role), ARRAY[]::app_role[])
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- Create RPC function for users to set their own role (one-time only)
CREATE OR REPLACE FUNCTION public.set_user_role(_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow setting role once (prevent privilege escalation)
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Role already set for this user. Contact admin to change role.';
  END IF;
  
  -- Validate role is one users can self-assign (exclude admin-only roles if any)
  IF _role IS NULL THEN
    RAISE EXCEPTION 'Role cannot be null';
  END IF;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), _role);
END;
$$;

-- RLS policies for user_roles table

-- Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Only the set_user_role function can insert (SECURITY DEFINER handles this)
-- No direct INSERT policy needed - function handles insertion

-- Prevent users from updating roles directly (admin-only in future)
-- No UPDATE or DELETE policies - roles cannot be changed by users