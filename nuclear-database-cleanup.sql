-- NUCLEAR OPTION: Complete database cleanup and rebuild
-- This will remove ALL functions and tables related to caching/queuing

-- Step 1: Drop ALL functions (including any duplicates)
DO $$ 
DECLARE
    func_record RECORD;
BEGIN
    -- Get all functions that might be related to our caching system
    FOR func_record IN 
        SELECT routine_name, routine_type, specific_name
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND (
            routine_name LIKE '%prompt_hash%' OR
            routine_name LIKE '%cached_image%' OR
            routine_name LIKE '%generation_status%' OR
            routine_name LIKE '%cache%'
        )
    LOOP
        EXECUTE 'DROP ' || func_record.routine_type || ' IF EXISTS ' || func_record.specific_name || ' CASCADE';
    END LOOP;
END $$;

-- Step 2: Drop ALL tables
DROP TABLE IF EXISTS public.image_cache CASCADE;
DROP TABLE IF EXISTS public.generation_status CASCADE;

-- Step 3: Create fresh tables
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

-- Step 4: Create indexes
CREATE INDEX idx_image_cache_prompt_hash ON public.image_cache(prompt_hash);
CREATE INDEX idx_generation_status_prompt_hash ON public.generation_status(prompt_hash);

-- Step 5: Enable RLS
ALTER TABLE public.image_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_status ENABLE ROW LEVEL SECURITY;

-- Step 6: Create policies
CREATE POLICY "Allow public read access to image cache" ON public.image_cache FOR SELECT USING (true);
CREATE POLICY "Allow public read access to generation status" ON public.generation_status FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to create cache entries" ON public.image_cache FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow authenticated users to create generation status" ON public.generation_status FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow users to update generation status" ON public.generation_status FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Step 7: Create functions with unique names to avoid conflicts
CREATE OR REPLACE FUNCTION public.generate_prompt_hash_v2(
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

CREATE OR REPLACE FUNCTION public.get_cached_image_v2(
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
  prompt_hash_value := public.generate_prompt_hash_v2(prompt_text, dimensions_text, format_text);
  
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

CREATE OR REPLACE FUNCTION public.store_cached_image_v2(
  prompt_text TEXT,
  dimensions_text TEXT,
  format_text TEXT,
  generated_url_text TEXT
) RETURNS UUID AS $$
DECLARE
  prompt_hash_value VARCHAR(64);
  cache_id UUID;
BEGIN
  prompt_hash_value := public.generate_prompt_hash_v2(prompt_text, dimensions_text, format_text);
  
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

CREATE OR REPLACE FUNCTION public.get_or_create_generation_status_v2(
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
  prompt_hash_value := public.generate_prompt_hash_v2(prompt_text, dimensions_text, format_text);
  
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

CREATE OR REPLACE FUNCTION public.update_generation_status_v2(
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

CREATE OR REPLACE FUNCTION public.get_generation_status_by_id_v2(
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

-- Step 8: Create aliases with the original names for backward compatibility
CREATE OR REPLACE FUNCTION public.generate_prompt_hash(
  prompt_text TEXT,
  dimensions_text TEXT,
  format_text TEXT
) RETURNS VARCHAR(64) AS $$
BEGIN
  RETURN public.generate_prompt_hash_v2(prompt_text, dimensions_text, format_text);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_cached_image(
  prompt_text TEXT,
  dimensions_text TEXT,
  format_text TEXT
) RETURNS TABLE (
  cached_url TEXT,
  cache_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.get_cached_image_v2(prompt_text, dimensions_text, format_text);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.store_cached_image(
  prompt_text TEXT,
  dimensions_text TEXT,
  format_text TEXT,
  generated_url_text TEXT
) RETURNS UUID AS $$
BEGIN
  RETURN public.store_cached_image_v2(prompt_text, dimensions_text, format_text, generated_url_text);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_or_create_generation_status(
  prompt_text TEXT,
  dimensions_text TEXT,
  format_text TEXT
) RETURNS TABLE (
  status_id UUID,
  current_status VARCHAR(20),
  generated_url TEXT,
  total_requests INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.get_or_create_generation_status_v2(prompt_text, dimensions_text, format_text);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_generation_status(
  status_id_param UUID,
  new_status VARCHAR(20),
  generated_url_param TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  PERFORM public.update_generation_status_v2(status_id_param, new_status, generated_url_param);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_generation_status_by_id(
  status_id_param UUID
) RETURNS TABLE (
  status VARCHAR(20),
  generated_url TEXT,
  total_requests INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.get_generation_status_by_id_v2(status_id_param);
END;
$$ LANGUAGE plpgsql;

SELECT 'Nuclear database cleanup and rebuild completed successfully!' as message;
