-- Step 1 of 2: Add role + client_id columns to profiles.
-- NO RLS policy changes. NO data-loading changes. App behaviour is unchanged.

-- 1. Add role column (admin or client; defaults to 'client')
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'client';

-- 2. Add client_id column (nullable; admins won't have one)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- 3. Mark the admin user.
--    ⚠️  REPLACE 'MIKE_EMAIL_HERE' WITH YOUR ACTUAL LOGIN EMAIL BEFORE RUNNING.
UPDATE public.profiles
  SET role = 'admin'
  WHERE id = (
    SELECT id FROM auth.users WHERE email = 'MIKE_EMAIL_HERE'
  );
