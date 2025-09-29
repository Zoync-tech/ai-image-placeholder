-- Simple migration to fix foreign key constraints
-- Run this in Supabase SQL Editor

-- Step 1: Drop old foreign key constraints
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_user_id_fkey;
ALTER TABLE public.image_generations DROP CONSTRAINT IF EXISTS image_generations_user_id_fkey;
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;

-- Step 2: Add new foreign key constraints pointing to profiles table
ALTER TABLE public.api_keys 
ADD CONSTRAINT api_keys_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE public.image_generations 
ADD CONSTRAINT image_generations_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE public.sessions 
ADD CONSTRAINT sessions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id);

