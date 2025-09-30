-- Quick test to verify database setup is working
-- Run this in Supabase SQL Editor to check if tables exist

-- Test 1: Check if tables exist
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('image_cache', 'generation_status')
ORDER BY table_name;

-- Test 2: Check if functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'generate_prompt_hash',
    'get_cached_image', 
    'store_cached_image',
    'get_or_create_generation_status',
    'update_generation_status',
    'get_generation_status_by_id'
  )
ORDER BY routine_name;

-- Test 3: Test the generate_prompt_hash function
SELECT generate_prompt_hash('test prompt', '1024x1024', 'jpg') as test_hash;

-- Test 4: Check if we can create a test generation status
SELECT * FROM get_or_create_generation_status('test prompt', '1024x1024', 'jpg', null);

-- If any of these fail, run the database-setup-safe.sql script again
