-- Fix RLS policies to avoid recursion
-- The issue is that admin policies query the same table, causing RLS to recurse

-- First, create a helper function that bypasses RLS to check admin status
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = user_id AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.user_profiles;

-- Recreate policies using the helper function

-- Users can always read their own profile
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can read all profiles (using helper function to avoid recursion)
CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Admins can update any profile
CREATE POLICY "Admins can update profiles"
  ON public.user_profiles FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- Admins can delete profiles (except themselves)
CREATE POLICY "Admins can delete profiles"
  ON public.user_profiles FOR DELETE
  USING (public.is_admin(auth.uid()) AND id != auth.uid());
