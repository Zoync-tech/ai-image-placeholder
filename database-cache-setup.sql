-- Create image cache table to store generated images/videos
-- This prevents duplicate API calls for the same prompt
CREATE TABLE IF NOT EXISTS public.image_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_hash VARCHAR(64) NOT NULL, -- SHA256 hash of the prompt + dimensions + settings
  prompt TEXT NOT NULL,
  dimensions VARCHAR(20) NOT NULL, -- e.g., "1024x1024"
  format VARCHAR(10) NOT NULL, -- "jpg", "png", "webp", "mp4", etc.
  generated_url TEXT NOT NULL, -- URL to the generated image/video
  file_size INTEGER, -- Size in bytes
  generation_time_ms INTEGER, -- Time taken to generate in milliseconds
  created_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  access_count INTEGER DEFAULT 0, -- How many times this cached result was used
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookups by prompt hash
CREATE INDEX IF NOT EXISTS idx_image_cache_prompt_hash ON public.image_cache(prompt_hash);

-- Create index for cleanup of old cache entries
CREATE INDEX IF NOT EXISTS idx_image_cache_created_at ON public.image_cache(created_at);

-- RLS policies for image cache
ALTER TABLE public.image_cache ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read cached images (no authentication required for cache hits)
CREATE POLICY "Allow public read access to image cache" ON public.image_cache
  FOR SELECT USING (true);

-- Only authenticated users can create cache entries
CREATE POLICY "Allow authenticated users to create cache entries" ON public.image_cache
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update access count and last accessed time
CREATE POLICY "Allow users to update access stats" ON public.image_cache
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Function to generate prompt hash
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

-- Function to get cached image or return null
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
  -- Generate hash for the prompt
  prompt_hash_value := generate_prompt_hash(prompt_text, dimensions_text, format_text, additional_settings);
  
  -- Look for existing cache entry
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

-- Function to store cached image
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
  -- Generate hash for the prompt
  prompt_hash_value := generate_prompt_hash(prompt_text, dimensions_text, format_text);
  
  -- Insert cache entry
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

-- Function to update access count
CREATE OR REPLACE FUNCTION update_cache_access(cache_id_param UUID) RETURNS VOID AS $$
BEGIN
  UPDATE public.image_cache 
  SET 
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE id = cache_id_param;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function to remove old cache entries (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_cache_entries() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.image_cache 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to cleanup old cache entries (if using pg_cron extension)
-- This is optional and requires pg_cron extension to be enabled
-- SELECT cron.schedule('cleanup-image-cache', '0 2 * * *', 'SELECT cleanup_old_cache_entries();');

COMMENT ON TABLE public.image_cache IS 'Cache table for generated images/videos to prevent duplicate API calls';
COMMENT ON FUNCTION generate_prompt_hash IS 'Generates SHA256 hash for prompt + dimensions + format + settings';
COMMENT ON FUNCTION get_cached_image IS 'Retrieves cached image URL if exists for given prompt parameters';
COMMENT ON FUNCTION store_cached_image IS 'Stores generated image URL in cache';
COMMENT ON FUNCTION update_cache_access IS 'Updates access count and last accessed time for cache entry';
COMMENT ON FUNCTION cleanup_old_cache_entries IS 'Removes cache entries older than 30 days';
