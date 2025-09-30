-- Generation status tracking and request queuing system
-- This prevents multiple API calls for the same prompt when multiple users load simultaneously

CREATE TABLE IF NOT EXISTS public.generation_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA256 hash of prompt + dimensions + format
  prompt TEXT NOT NULL,
  dimensions VARCHAR(20) NOT NULL,
  format VARCHAR(10) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, generating, completed, failed
  generated_url TEXT, -- URL of the generated image/video
  error_message TEXT, -- Error message if generation failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE, -- When generation actually started
  completed_at TIMESTAMP WITH TIME ZONE, -- When generation completed
  created_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  generation_time_ms INTEGER, -- Time taken to generate
  file_size INTEGER, -- Size of generated file
  api_calls_made INTEGER DEFAULT 0, -- Track how many API calls were made
  total_requests INTEGER DEFAULT 1 -- Track total requests for this prompt
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_generation_status_prompt_hash ON public.generation_status(prompt_hash);
CREATE INDEX IF NOT EXISTS idx_generation_status_status ON public.generation_status(status);
CREATE INDEX IF NOT EXISTS idx_generation_status_created_at ON public.generation_status(created_at);

-- RLS policies
ALTER TABLE public.generation_status ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read generation status (for checking if generation is complete)
CREATE POLICY "Allow public read access to generation status" ON public.generation_status
  FOR SELECT USING (true);

-- Only authenticated users can create generation status entries
CREATE POLICY "Allow authenticated users to create generation status" ON public.generation_status
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update generation status
CREATE POLICY "Allow users to update generation status" ON public.generation_status
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Function to get or create generation status
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
  -- Generate hash for the prompt
  prompt_hash_value := generate_prompt_hash(prompt_text, dimensions_text, format_text);
  
  -- Check if generation already exists or is in progress
  SELECT id, status, generated_url, total_requests
  INTO existing_record
  FROM public.generation_status
  WHERE prompt_hash = prompt_hash_value;
  
  IF existing_record.id IS NOT NULL THEN
    -- Update request count
    UPDATE public.generation_status 
    SET total_requests = total_requests + 1
    WHERE id = existing_record.id;
    
    -- Return existing status
    RETURN QUERY
    SELECT 
      existing_record.id,
      existing_record.status,
      existing_record.generated_url,
      existing_record.total_requests + 1;
  ELSE
    -- Create new generation status entry
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
    
    -- Return new status
    RETURN QUERY
    SELECT 
      existing_record.id,
      existing_record.status,
      existing_record.generated_url,
      existing_record.total_requests;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update generation status
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

-- Function to get generation status by ID
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

-- Function to cleanup old generation status entries (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_generation_status() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.generation_status 
  WHERE created_at < NOW() - INTERVAL '1 hour'
    AND status IN ('completed', 'failed');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get generation statistics
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

COMMENT ON TABLE public.generation_status IS 'Tracks generation status and queues requests to prevent duplicate API calls';
COMMENT ON FUNCTION get_or_create_generation_status IS 'Gets existing generation status or creates new one, increments request count';
COMMENT ON FUNCTION update_generation_status IS 'Updates generation status with progress information';
COMMENT ON FUNCTION get_generation_status_by_id IS 'Retrieves generation status by ID';
COMMENT ON FUNCTION cleanup_old_generation_status IS 'Removes old generation status entries';
COMMENT ON FUNCTION get_generation_stats IS 'Returns generation statistics and API call savings';
