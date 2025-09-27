const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key for server-side operations
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // Anon key for client-side operations

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseServiceKey && supabaseAnonKey;

if (!isSupabaseConfigured) {
  console.warn('⚠️  Supabase environment variables not set. Authentication features will be disabled.');
  console.warn('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY to enable authentication.');
}

// Create Supabase clients (with fallback for missing config)
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseServiceKey) : null;
const supabaseClient = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Utility functions for database operations
class SupabaseService {
  
  // Create user profile and API key when user signs up
  static async createUserProfile(user) {
    try {
      // Create profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || null
        })
        .select()
        .single();
      
      if (profileError) {
        console.error('Error creating profile:', profileError);
        throw new Error(`Failed to create user profile: ${profileError.message}`);
      }
      
      console.log('Profile created successfully:', profileData);
      
      // Create default API key
      const apiKey = await this.generateApiKey(user.id, 'Default API Key');
      
      return apiKey;
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }
  
  // Get or create user profile
  static async getOrCreateUserProfile(user) {
    try {
      let profile = await this.getUserProfile(user.id);
      
      if (!profile) {
        // Create profile if it doesn't exist
        await this.createUserProfile(user);
        profile = await this.getUserProfile(user.id);
      }
      
      return profile;
    } catch (error) {
      console.error('Error getting/creating user profile:', error);
      throw error;
    }
  }
  
  // Generate a new API key for user
  static async generateApiKey(userId, name = 'Default API Key') {
    // First check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (profileError || !profile) {
      console.error('Profile not found for user:', userId, profileError);
      throw new Error('User profile not found. Please ensure profile is created first.');
    }
    
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
