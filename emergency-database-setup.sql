-- EMERGENCY: Simple cache table without complex functions
-- Use this if the main setup is failing

-- Drop ALL existing functions first to avoid conflicts
DROP FUNCTION IF EXISTS generate_prompt_hash(TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_cached_image(TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS store_cached_image(TEXT, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_or_create_generation_status(TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_generation_status(UUID, VARCHAR, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_generation_status_by_id(UUID) CASCADE;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.image_cache CASCADE;
DROP TABLE IF EXISTS public.generation_status CASCADE;

-- Create simple image cache table
CREATE TABLE public.image_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_hash VARCHAR(64) NOT NULL,
  prompt TEXT NOT NULL,
  dimensions VARCHAR(20) NOT NULL,
  format VARCHAR(10) NOT NULL,
  generated_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  access_count INTEGER DEFAULT 0
);

-- Create simple generation status table
CREATE TABLE public.generation_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_hash VARCHAR(64) NOT NULL UNIQUE,
  prompt TEXT NOT NULL,
  dimensions VARCHAR(20) NOT NULL,
  format VARCHAR(10) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  generated_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_requests INTEGER DEFAULT 1
);

-- Create indexes
CREATE INDEX idx_image_cache_prompt_hash ON public.image_cache(prompt_hash);
CREATE INDEX idx_generation_status_prompt_hash ON public.generation_status(prompt_hash);

-- Enable RLS
ALTER TABLE public.image_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_status ENABLE ROW LEVEL SECURITY;

-- Simple policies
CREATE POLICY "Allow public read access to image cache" ON public.image_cache FOR SELECT USING (true);
CREATE POLICY "Allow public read access to generation status" ON public.generation_status FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to create cache entries" ON public.image_cache FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow authenticated users to create generation status" ON public.generation_status FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow users to update generation status" ON public.generation_status FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Simple function to generate hash
CREATE OR REPLACE FUNCTION generate_prompt_hash(
  prompt_text TEXT,
  dimensions_text TEXT,
  format_text TEXT
) RETURNS VARCHAR(64) AS $$
BEGIN
  RETURN encode(
    digest(
      COALESCE(prompt_text, '') || '|' || 
      COALESCE(dimensions_text, '') || '|' || 
      COALESCE(format_text, ''),
      'sha256'
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql;

-- Simple function to get cached image
CREATE OR REPLACE FUNCTION get_cached_image(
  prompt_text TEXT,
  dimensions_text TEXT,
  format_text TEXT
) RETURNS TABLE (
  cached_url TEXT,
  cache_id UUID
) AS $$
DECLARE
  prompt_hash_value VARCHAR(64);
BEGIN
  prompt_hash_value := generate_prompt_hash(prompt_text, dimensions_text, format_text);
  
  RETURN QUERY
  SELECT 
    ic.generated_url,
    ic.id
  FROM public.image_cache ic
  WHERE ic.prompt_hash = prompt_hash_value
  ORDER BY ic.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Simple function to store cached image
CREATE OR REPLACE FUNCTION store_cached_image(
  prompt_text TEXT,
  dimensions_text TEXT,
  format_text TEXT,
  generated_url_text TEXT
) RETURNS UUID AS $$
DECLARE
  prompt_hash_value VARCHAR(64);
  cache_id UUID;
BEGIN
  prompt_hash_value := generate_prompt_hash(prompt_text, dimensions_text, format_text);
  
  INSERT INTO public.image_cache (
    prompt_hash,
    prompt,
    dimensions,
    format,
    generated_url
  ) VALUES (
    prompt_hash_value,
    prompt_text,
    dimensions_text,
    format_text,
    generated_url_text
  ) RETURNING id INTO cache_id;
  
  RETURN cache_id;
END;
$$ LANGUAGE plpgsql;

-- Simple function to get or create generation status
CREATE OR REPLACE FUNCTION get_or_create_generation_status(
  prompt_text TEXT,
  dimensions_text TEXT,
  format_text TEXT
) RETURNS TABLE (
  status_id UUID,
  current_status VARCHAR(20),
  generated_url TEXT,
  total_requests INTEGER
) AS $$
DECLARE
  prompt_hash_value VARCHAR(64);
  existing_record RECORD;
BEGIN
  prompt_hash_value := generate_prompt_hash(prompt_text, dimensions_text, format_text);
  
  SELECT id, status, gs.generated_url, total_requests
  INTO existing_record
  FROM public.generation_status gs
  WHERE gs.prompt_hash = prompt_hash_value;
  
  IF existing_record.id IS NOT NULL THEN
    UPDATE public.generation_status 
    SET total_requests = total_requests + 1
    WHERE id = existing_record.id;
    
    RETURN QUERY
    SELECT 
      existing_record.id,
      existing_record.status,
      existing_record.generated_url,
      existing_record.total_requests + 1;
  ELSE
    INSERT INTO public.generation_status (
      prompt_hash,
      prompt,
      dimensions,
      format,
      status
    ) VALUES (
      prompt_hash_value,
      prompt_text,
      dimensions_text,
      format_text,
      'pending'
    ) RETURNING id, status, generated_url, total_requests
    INTO existing_record;
    
    RETURN QUERY
    SELECT 
      existing_record.id,
      existing_record.status,
      existing_record.generated_url,
      existing_record.total_requests;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Simple function to update generation status
CREATE OR REPLACE FUNCTION update_generation_status(
  status_id_param UUID,
  new_status VARCHAR(20),
  generated_url_param TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE public.generation_status 
  SET 
    status = new_status,
    generated_url = generated_url_param
  WHERE id = status_id_param;
END;
$$ LANGUAGE plpgsql;

-- Simple function to get generation status by ID
DROP FUNCTION IF EXISTS get_generation_status_by_id(UUID);
CREATE FUNCTION get_generation_status_by_id(
  status_id_param UUID
) RETURNS TABLE (
  status VARCHAR(20),
  generated_url TEXT,
  total_requests INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gs.status,
    gs.generated_url,
    gs.total_requests,
    gs.created_at
  FROM public.generation_status gs
  WHERE gs.id = status_id_param;
END;
$$ LANGUAGE plpgsql;

SELECT 'Emergency database setup completed successfully!' as message;
