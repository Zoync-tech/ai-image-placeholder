-- Migration script to consolidate users and profiles tables
-- This script updates foreign key constraints to use profiles.id instead of users.id

-- Step 1: Drop existing foreign key constraints that reference users table
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_user_id_fkey;
ALTER TABLE public.image_generations DROP CONSTRAINT IF EXISTS image_generations_user_id_fkey;
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;

-- Step 2: Add new foreign key constraints that reference profiles table
ALTER TABLE public.api_keys 
ADD CONSTRAINT api_keys_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE public.image_generations 
ADD CONSTRAINT image_generations_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE public.sessions 
ADD CONSTRAINT sessions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-- Step 3: Update any existing data in api_keys table to use profile IDs
-- (This assumes that profiles.id = auth.users.id = users.id)
UPDATE public.api_keys 
SET user_id = (
  SELECT p.id 
  FROM public.profiles p 
  WHERE p.id = api_keys.user_id
)
WHERE EXISTS (
  SELECT 1 
  FROM public.profiles p 
  WHERE p.id = api_keys.user_id
);

-- Step 4: Update any existing data in image_generations table to use profile IDs
UPDATE public.image_generations 
SET user_id = (
  SELECT p.id 
  FROM public.profiles p 
  WHERE p.id = image_generations.user_id
)
WHERE EXISTS (
  SELECT 1 
  FROM public.profiles p 
  WHERE p.id = image_generations.user_id
);

-- Step 5: Update any existing data in sessions table to use profile IDs
UPDATE public.sessions 
SET user_id = (
  SELECT p.id 
  FROM public.profiles p 
  WHERE p.id = sessions.user_id
)
WHERE EXISTS (
  SELECT 1 
  FROM public.profiles p 
  WHERE p.id = sessions.user_id
);

-- Step 6: Drop the redundant users table
-- (Only do this after confirming all data has been migrated)
-- DROP TABLE IF EXISTS public.users;

-- Note: The users table is commented out for safety.
-- Uncomment the line above only after verifying that:
-- 1. All foreign key constraints are working correctly
-- 2. All API endpoints are working correctly
-- 3. No data is being lost
