const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key for server-side operations
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // Anon key for client-side operations

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Create Supabase clients
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Utility functions for database operations
class SupabaseService {
  
  // Generate a new API key for user
  static async generateApiKey(userId, name = 'Default API Key') {
    const apiKey = `ai_${uuidv4().replace(/-/g, '')}_${Math.random().toString(36).substring(2, 10)}`;
    
    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        api_key: apiKey,
        name: name
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error generating API key:', error);
      throw new Error('Failed to generate API key');
    }
    
    return data;
  }
  
  // Validate API key and get user info
  static async validateApiKey(apiKey) {
    const { data, error } = await supabase
      .from('api_keys')
      .select(`
        id,
        user_id,
        name,
        is_active,
        total_requests,
        profiles!inner (
          id,
          email,
          credits
        )
      `)
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data;
  }
  
  // Check if user has enough credits
  static async checkUserCredits(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();
    
    if (error || !data) {
      return 0;
    }
    
    return data.credits;
  }
  
  // Deduct credits from user
  static async deductCredits(userId, creditsToDeduct = 1) {
    const { data, error } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();
    
    if (error || !data) {
      throw new Error('Failed to get user credits');
    }
    
    if (data.credits < creditsToDeduct) {
      throw new Error('Insufficient credits');
    }
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ credits: data.credits - creditsToDeduct })
      .eq('id', userId);
    
    if (updateError) {
      throw new Error('Failed to deduct credits');
    }
    
    return data.credits - creditsToDeduct;
  }
  
  // Log image generation
  static async logImageGeneration(userId, apiKeyId, prompt, dimensions, success, errorMessage = null) {
    const { error } = await supabase
      .from('image_generations')
      .insert({
        user_id: userId,
        api_key_id: apiKeyId,
        prompt: prompt,
        dimensions: dimensions,
        credits_used: 1,
        success: success,
        error_message: errorMessage
      });
    
    if (error) {
      console.error('Error logging image generation:', error);
    }
    
    // Update API key usage stats
    if (success) {
      await supabase
        .from('api_keys')
        .update({ 
          total_requests: supabase.raw('total_requests + 1'),
          last_used_at: new Date().toISOString()
        })
        .eq('id', apiKeyId);
    }
  }
  
  // Get user's API keys
  static async getUserApiKeys(userId) {
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error getting user API keys:', error);
      return [];
    }
    
    return data || [];
  }
  
  // Get user's image generation history
  static async getUserImageHistory(userId, limit = 50) {
    const { data, error } = await supabase
      .from('image_generations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error getting user image history:', error);
      return [];
    }
    
    return data || [];
  }
  
  // Get user profile
  static async getUserProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
    
    return data;
  }
}

module.exports = {
  supabase,
  supabaseClient,
  SupabaseService
};
