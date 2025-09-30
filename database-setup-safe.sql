-- Safe database setup that handles existing objects
-- This will not fail if tables/policies/functions already exist

-- Create image cache table (safe)
CREATE TABLE IF NOT EXISTS public.image_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_hash VARCHAR(64) NOT NULL,
  prompt TEXT NOT NULL,
  dimensions VARCHAR(20) NOT NULL,
  format VARCHAR(10) NOT NULL,
  generated_url TEXT NOT NULL,
  file_size INTEGER,
  generation_time_ms INTEGER,
  created_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create generation status table (safe)
CREATE TABLE IF NOT EXISTS public.generation_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_hash VARCHAR(64) NOT NULL UNIQUE,
  prompt TEXT NOT NULL,
  dimensions VARCHAR(20) NOT NULL,
  format VARCHAR(10) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  generated_url TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  generation_time_ms INTEGER,
  file_size INTEGER,
  api_calls_made INTEGER DEFAULT 0,
  total_requests INTEGER DEFAULT 1
);

-- Create indexes (safe)
CREATE INDEX IF NOT EXISTS idx_image_cache_prompt_hash ON public.image_cache(prompt_hash);
CREATE INDEX IF NOT EXISTS idx_image_cache_created_at ON public.image_cache(created_at);
CREATE INDEX IF NOT EXISTS idx_generation_status_prompt_hash ON public.generation_status(prompt_hash);
CREATE INDEX IF NOT EXISTS idx_generation_status_status ON public.generation_status(status);
CREATE INDEX IF NOT EXISTS idx_generation_status_created_at ON public.generation_status(created_at);

-- Enable RLS (safe)
ALTER TABLE public.image_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_status ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate them
DO $$ 
BEGIN
    -- Drop existing policies for image_cache
    DROP POLICY IF EXISTS "Allow public read access to image cache" ON public.image_cache;
    DROP POLICY IF EXISTS "Allow authenticated users to create cache entries" ON public.image_cache;
    DROP POLICY IF EXISTS "Allow users to update access stats" ON public.image_cache;
    
    -- Drop existing policies for generation_status
    DROP POLICY IF EXISTS "Allow public read access to generation status" ON public.generation_status;
    DROP POLICY IF EXISTS "Allow authenticated users to create generation status" ON public.generation_status;
    DROP POLICY IF EXISTS "Allow users to update generation status" ON public.generation_status;
    
    -- Recreate policies for image_cache
    CREATE POLICY "Allow public read access to image cache" ON public.image_cache
      FOR SELECT USING (true);
    
    CREATE POLICY "Allow authenticated users to create cache entries" ON public.image_cache
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
    
    CREATE POLICY "Allow users to update access stats" ON public.image_cache
      FOR UPDATE USING (auth.uid() IS NOT NULL);
    
    -- Recreate policies for generation_status
    CREATE POLICY "Allow public read access to generation status" ON public.generation_status
      FOR SELECT USING (true);
    
    CREATE POLICY "Allow authenticated users to create generation status" ON public.generation_status
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
    
    CREATE POLICY "Allow users to update generation status" ON public.generation_status
      FOR UPDATE USING (auth.uid() IS NOT NULL);
END $$;

-- Create or replace functions (safe)
CREATE OR REPLACE FUNCTION generate_prompt_hash(
  prompt_text TEXT,
  dimensions_text TEXT,
  format_text TEXT,
  additional_settings TEXT DEFAULT ''
) RETURNS VARCHAR(64) AS $$
BEGIN
  RETURN encode(
    digest(
      COALESCE(prompt_text, '') || '|' || 
      COALESCE(dimensions_text, '') || '|' || 
      COALESCE(format_text, '') || '|' || 
      COALESCE(additional_settings, ''),
      'sha256'
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_cached_image(
  prompt_text TEXT,
  dimensions_text TEXT,
  format_text TEXT,
  additional_settings TEXT DEFAULT ''
) RETURNS TABLE (
  cached_url TEXT,
  cache_id UUID
) AS $$
DECLARE
  prompt_hash_value VARCHAR(64);
BEGIN
  prompt_hash_value := generate_prompt_hash(prompt_text, dimensions_text, format_text, additional_settings);
  
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

CREATE OR REPLACE FUNCTION store_cached_image(
  prompt_text TEXT,
  dimensions_text TEXT,
  format_text TEXT,
  generated_url_text TEXT,
  file_size_bytes INTEGER DEFAULT NULL,
  generation_time_ms INTEGER DEFAULT NULL,
  user_id_param UUID DEFAULT NULL
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
    generated_url,
    file_size,
    generation_time_ms,
    created_by_user_id
  ) VALUES (
    prompt_hash_value,
    prompt_text,
    dimensions_text,
    format_text,
    generated_url_text,
    file_size_bytes,
    generation_time_ms,
    user_id_param
  ) RETURNING id INTO cache_id;
  
  RETURN cache_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_cache_access(cache_id_param UUID) RETURNS VOID AS $$
BEGIN
  UPDATE public.image_cache 
  SET 
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE id = cache_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_or_create_generation_status(
  prompt_text TEXT,
  dimensions_text TEXT,
  format_text TEXT,
  user_id_param UUID DEFAULT NULL
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
  
  SELECT id, status, generated_url, total_requests
  INTO existing_record
  FROM public.generation_status
  WHERE prompt_hash = prompt_hash_value;
  
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
      created_by_user_id,
      status
    ) VALUES (
      prompt_hash_value,
      prompt_text,
      dimensions_text,
      format_text,
      user_id_param,
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

CREATE OR REPLACE FUNCTION update_generation_status(
  status_id_param UUID,
  new_status VARCHAR(20),
  generated_url_param TEXT DEFAULT NULL,
  error_message_param TEXT DEFAULT NULL,
  generation_time_ms_param INTEGER DEFAULT NULL,
  file_size_param INTEGER DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE public.generation_status 
  SET 
    status = new_status,
    generated_url = generated_url_param,
    error_message = error_message_param,
    generation_time_ms = generation_time_ms_param,
    file_size = file_size_param,
    started_at = CASE 
      WHEN new_status = 'generating' AND started_at IS NULL THEN NOW()
      ELSE started_at
    END,
    completed_at = CASE 
      WHEN new_status IN ('completed', 'failed') THEN NOW()
      ELSE completed_at
    END,
    api_calls_made = CASE 
      WHEN new_status = 'generating' THEN api_calls_made + 1
      ELSE api_calls_made
    END
  WHERE id = status_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_generation_status_by_id(
  status_id_param UUID
) RETURNS TABLE (
  status VARCHAR(20),
  generated_url TEXT,
  error_message TEXT,
  total_requests INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gs.status,
    gs.generated_url,
    gs.error_message,
    gs.total_requests,
    gs.created_at
  FROM public.generation_status gs
  WHERE gs.id = status_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_generation_stats() RETURNS TABLE (
  total_generations INTEGER,
  pending_generations INTEGER,
  completed_generations INTEGER,
  failed_generations INTEGER,
  total_api_calls_saved INTEGER,
  avg_requests_per_generation NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_generations,
    COUNT(*) FILTER (WHERE status = 'pending')::INTEGER as pending_generations,
    COUNT(*) FILTER (WHERE status = 'completed')::INTEGER as completed_generations,
    COUNT(*) FILTER (WHERE status = 'failed')::INTEGER as failed_generations,
    SUM(total_requests - api_calls_made)::INTEGER as total_api_calls_saved,
    ROUND(AVG(total_requests), 2) as avg_requests_per_generation
  FROM public.generation_status
  WHERE created_at > NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Success message
SELECT 'Database setup completed successfully! Queuing system is now active.' as message;
