require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const imageQueue = require('./image-queue');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'User-Agent']
}));
app.use(express.json());
app.use(express.static('public'));

// Initialize Supabase (with error handling)
let supabase = null;
let SupabaseService = null;

// Debug environment variables
console.log('Environment check:');
console.log('- SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
console.log('- SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing');
console.log('- SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing');

// Try direct Supabase initialization first
try {
  const { createClient } = require('@supabase/supabase-js');
  
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('✅ Direct Supabase client created');
    
    // Test the connection
    supabase.from('profiles').select('count').limit(1)
      .then(({ data, error }) => {
        if (error) {
          console.warn('⚠️  Supabase connection test failed:', error.message);
        } else {
          console.log('✅ Supabase connection test successful');
        }
      })
      .catch((testError) => {
        console.warn('⚠️  Supabase connection test error:', testError.message);
      });
    } else {
    console.warn('⚠️  Missing Supabase environment variables for direct initialization');
    }
  } catch (error) {
  console.warn('⚠️  Direct Supabase initialization failed:', error.message);
}

// Try to load SupabaseService from module
try {
  const { SupabaseService: SupabaseServiceClass } = require('./supabase-config');
  SupabaseService = SupabaseServiceClass;
  console.log('✅ SupabaseService loaded from module');
} catch (error) {
  console.warn('⚠️  SupabaseService module load failed:', error.message);
  console.warn('Creating simplified SupabaseService...');
  
  // Create a simplified SupabaseService directly
  // Use crypto.randomUUID() instead of uuid package to avoid ES module issues
  const crypto = require('crypto');
  
  class SimplifiedSupabaseService {
    // Get user profile
    static async getUserProfile(userId) {
      if (!supabase) return null;
      
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
    
    // Create user profile
    static async createUserProfile(user) {
      if (!supabase) throw new Error('Supabase not available');
      
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
    }
    
    // Get or create user profile
    static async getOrCreateUserProfile(user) {
      try {
        let profile = await this.getUserProfile(user.id);
        
        if (!profile) {
          await this.createUserProfile(user);
          profile = await this.getUserProfile(user.id);
        }
        
        return profile;
      } catch (error) {
        console.error('Error getting/creating user profile:', error);
        throw error;
      }
    }
    
    // Generate API key
    static async generateApiKey(userId, name = 'Default API Key') {
      if (!supabase) throw new Error('Supabase not available');
      
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
      
      const apiKey = `ai_${crypto.randomUUID().replace(/-/g, '')}_${Math.random().toString(36).substring(2, 10)}`;
      
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
    
    // Get user's API keys
    static async getUserApiKeys(userId) {
      if (!supabase) return [];
      
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
      if (!supabase) return [];
      
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
    
    // Validate API key and get user info
    static async validateApiKey(apiKey) {
      if (!supabase) return null;
      
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
    
     // Log image generation
     static async logImageGeneration(userId, apiKeyId, prompt, dimensions, success, errorMessage = null) {
       if (!supabase) return;
       
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
       if (success && apiKeyId) {
         await supabase
           .from('api_keys')
           .update({ 
             total_requests: supabase.raw('total_requests + 1'),
             last_used_at: new Date().toISOString()
           })
           .eq('id', apiKeyId);
       }
     }
     
     // Check if image/video is cached
     static async getCachedImage(prompt, dimensions, format, additionalSettings = '') {
       if (!supabase) return null;
       
       try {
         const { data, error } = await supabase
           .rpc('get_cached_image', {
             prompt_text: prompt,
             dimensions_text: dimensions,
             format_text: format,
             additional_settings: additionalSettings
           });
         
         if (error) {
           console.error('Error getting cached image:', error);
           return null;
         }
         
         if (data && data.length > 0) {
           // Update access count
           await this.updateCacheAccess(data[0].cache_id);
           return data[0].cached_url;
         }
         
         return null;
       } catch (error) {
         console.error('Error in getCachedImage:', error);
         return null;
       }
     }
     
     // Store generated image/video in cache
     static async storeCachedImage(prompt, dimensions, format, generatedUrl, fileSize = null, generationTimeMs = null, userId = null) {
       if (!supabase) return null;
       
       try {
         const { data, error } = await supabase
           .rpc('store_cached_image', {
             prompt_text: prompt,
             dimensions_text: dimensions,
             format_text: format,
             generated_url_text: generatedUrl,
             file_size_bytes: fileSize,
             generation_time_ms: generationTimeMs,
             user_id_param: userId
           });
         
         if (error) {
           console.error('Error storing cached image:', error);
    return null;
  }
  
         return data;
       } catch (error) {
         console.error('Error in storeCachedImage:', error);
         return null;
       }
     }
     
     // Update cache access count
     static async updateCacheAccess(cacheId) {
       if (!supabase) return;
       
       try {
         await supabase.rpc('update_cache_access', {
           cache_id_param: cacheId
         });
       } catch (error) {
         console.error('Error updating cache access:', error);
       }
     }
     
     // Get or create generation status (for request queuing)
     static async getOrCreateGenerationStatus(prompt, dimensions, format, userId = null) {
       if (!supabase) return null;
       
       try {
         const { data, error } = await supabase
           .rpc('get_or_create_generation_status', {
             prompt_text: prompt,
             dimensions_text: dimensions,
             format_text: format,
             user_id_param: userId
           });
         
         if (error) {
           console.error('Error getting/creating generation status:', error);
    return null;
  }
  
         if (data && data.length > 0) {
           return {
             id: data[0].status_id,
             status: data[0].current_status,
             generatedUrl: data[0].generated_url,
             totalRequests: data[0].total_requests
           };
         }
         
         return null;
       } catch (error) {
         console.error('Error in getOrCreateGenerationStatus:', error);
         return null;
       }
     }
     
     // Update generation status
     static async updateGenerationStatus(statusId, newStatus, generatedUrl = null, errorMessage = null, generationTimeMs = null, fileSize = null) {
       if (!supabase) return;
       
       try {
         await supabase.rpc('update_generation_status', {
           status_id_param: statusId,
           new_status: newStatus,
           generated_url_param: generatedUrl,
           error_message_param: errorMessage,
           generation_time_ms_param: generationTimeMs,
           file_size_param: fileSize
         });
       } catch (error) {
         console.error('Error updating generation status:', error);
       }
     }
     
     // Get generation status by ID
     static async getGenerationStatusById(statusId) {
       if (!supabase) return null;
       
       try {
         const { data, error } = await supabase
           .rpc('get_generation_status_by_id', {
             status_id_param: statusId
           });
         
         if (error) {
           console.error('Error getting generation status:', error);
           return null;
         }
         
         if (data && data.length > 0) {
           return {
             status: data[0].status,
             generatedUrl: data[0].generated_url,
             errorMessage: data[0].error_message,
             totalRequests: data[0].total_requests,
             createdAt: data[0].created_at
           };
         }
         
         return null;
       } catch (error) {
         console.error('Error in getGenerationStatusById:', error);
         return null;
       }
     }
  }
  
  SupabaseService = SimplifiedSupabaseService;
  
  console.log('✅ Simplified SupabaseService created');
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      port: PORT,
      hasSupabase: !!supabase,
      hasStripe: !!process.env.STRIPE_SECRET_KEY,
      supabaseUrl: process.env.SUPABASE_URL ? 'Set' : 'Missing',
      supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing'
    }
  });
});

// Debug endpoint
app.get('/debug', (req, res) => {
  res.json({
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      SUPABASE_URL: process.env.SUPABASE_URL ? 'Set' : 'Missing',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing',
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'Set' : 'Missing'
    },
    supabase: {
      initialized: !!supabase,
      serviceAvailable: !!SupabaseService
    }
  });
});

// Basic routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/auth', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

app.get('/verify', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verify.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/api-keys', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'api-keys.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

app.get('/subscription', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'subscription.html'));
});

app.get('/subscription-success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'subscription-success.html'));
});

app.get('/ai-image-generator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ai-image-generator.html'));
});

// Favicon and static asset routes
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.svg'));
});

// Handle other common static file requests
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send('User-agent: *\nDisallow:');
});

// Handle any other static files that might be requested
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  // Try to serve static files
  const filePath = path.join(__dirname, 'public', req.path);
  const ext = path.extname(filePath);
  
  // If it's a file request and the file exists, serve it
  if (ext && ext !== '.html') {
    res.sendFile(filePath, (err) => {
      if (err) {
        // File not found, continue to 404 handler
        next();
      }
    });
  } else {
    // Continue to 404 handler
    next();
  }
});

// Authentication API routes (with error handling)
app.post('/api/auth/login', async (req, res) => {
  try {
    if (!supabase || !SupabaseService) {
      return res.status(500).json({ error: 'Authentication service not available' });
    }

    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Login error:', error);
      return res.status(400).json({ error: error.message });
    }

    // Get or create user profile
    const profile = await SupabaseService.getOrCreateUserProfile(data.user);
  
  res.json({
      token: data.session.access_token,
      user: profile
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    if (!supabase || !SupabaseService) {
      return res.status(500).json({ error: 'Authentication service not available' });
    }

    const { email, password, fullName } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (error) {
      console.error('Signup error:', error);
      return res.status(400).json({ error: error.message });
    }
  
  res.json({
      success: true,
      user: data.user,
      message: 'Please check your email to verify your account'
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/api/auth/verify-email', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Authentication service not available' });
    }

    const { token, type } = req.body;
    
    if (!token || !type) {
      return res.status(400).json({ error: 'Token and type are required' });
    }

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type
    });

    if (error) {
      console.error('Verification error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({
      success: true,
      user: data.user,
      message: 'Email verified successfully'
    });
      } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Authentication service not available' });
    }

    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({
      success: true,
      message: 'Verification email sent'
    });
  } catch (error) {
    console.error('Resend error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Authentication service not available' });
    }

    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${req.headers.origin}/reset-password.html`
    });

    if (error) {
      console.error('Forgot password error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({
      success: true,
      message: 'Password reset email sent'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to send password reset email' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Authentication service not available' });
    }

    const { password, token } = req.body;
    
    if (!password || !token) {
      return res.status(400).json({ error: 'Password and token are required' });
    }

    const { data, error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      console.error('Reset password error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
      } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// User profile and management routes
app.get('/api/user/profile', async (req, res) => {
  try {
    if (!supabase || !SupabaseService) {
      return res.status(500).json({ error: 'Authentication service not available' });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const profile = await SupabaseService.getOrCreateUserProfile(user);
    res.json(profile);
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/user/api-keys', async (req, res) => {
  try {
    if (!supabase || !SupabaseService) {
      return res.status(500).json({ error: 'Authentication service not available' });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const apiKeys = await SupabaseService.getUserApiKeys(user.id);
    res.json({ api_keys: apiKeys });
  } catch (error) {
    console.error('Error getting API keys:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/user/image-generations', async (req, res) => {
  try {
    if (!supabase || !SupabaseService) {
      return res.status(500).json({ error: 'Authentication service not available' });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const generations = await SupabaseService.getUserImageHistory(user.id);
    res.json({ generations });
  } catch (error) {
    console.error('Error getting image generations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/create-key', async (req, res) => {
  try {
    if (!supabase || !SupabaseService) {
      return res.status(500).json({ error: 'Authentication service not available' });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { name } = req.body;
    const apiKey = await SupabaseService.generateApiKey(user.id, name || 'Default API Key');
    
    res.json({ 
      api_key: apiKey.api_key,
      credits: 100 // Default credits for new users
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Image generation endpoint with intelligent queuing system
app.get('/:width(\\d+)x:height(\\d+).:format(jpg|jpeg|png|webp)', async (req, res) => {
  try {
    const { width, height, format } = req.params;
    const { text, api_key } = req.query;

    // Validate dimensions
    const w = parseInt(width);
    const h = parseInt(height);
    
    if (w < 1 || w > 2048 || h < 1 || h > 2048) {
      return res.status(400).json({ error: 'Invalid dimensions. Must be between 1x1 and 2048x2048' });
    }

    // Check API key if provided
    let userId = null;
    let apiKeyData = null;
    if (api_key) {
      apiKeyData = await SupabaseService.validateApiKey(api_key);
      if (!apiKeyData) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
      userId = apiKeyData.user_id;
    }

    const prompt = text || `A beautiful ${w}x${h} placeholder image`;
    const dimensions = `${w}x${h}`;
    
    console.log(`🎯 Request for prompt: "${prompt}" (${dimensions}.${format})`);
    
    // 🚀 STEP 1: Check cache first (fastest response) - JavaScript queue
    const cachedUrl = imageQueue.getCachedImage(prompt, dimensions, format);
    if (cachedUrl) {
      console.log(`✅ Cache HIT! Returning cached image for prompt: "${prompt}"`);
      console.log(`💰 SAVED: No API call needed - cost avoided!`);
      
      // Log cache hit (no credits used)
      if (userId) {
        try {
          await SupabaseService.logImageGeneration(
            userId, 
            apiKeyData?.id,
            prompt, 
            dimensions, 
            true,
            'Cache hit - no API call'
          );
        } catch (logError) {
          console.error('Error logging cache hit:', logError);
        }
      }
      
      return res.redirect(cachedUrl);
    }
    
    // 🚀 STEP 2: Check generation status (queuing system) - JavaScript queue
    const generationStatus = imageQueue.getOrCreateGenerationStatus(prompt, dimensions, format);
    
    if (!generationStatus) {
      console.error('Failed to get/create generation status');
      return res.status(500).json({ error: 'Failed to initialize generation' });
    }
    
    console.log(`📊 Generation Status: ${generationStatus.status} (${generationStatus.totalRequests} total requests)`);
    
    // Handle different generation statuses
    switch (generationStatus.status) {
      case 'completed':
        console.log(`✅ Generation COMPLETED! Returning generated image for prompt: "${prompt}"`);
        console.log(`💰 SAVED: ${generationStatus.totalRequests - 1} duplicate API calls avoided!`);
        
        // Store in cache for future requests (JavaScript queue)
        imageQueue.storeCachedImage(prompt, dimensions, format, generationStatus.generatedUrl);
        
        return res.redirect(generationStatus.generatedUrl);
        
      case 'failed':
        console.log(`❌ Generation FAILED for prompt: "${prompt}"`);
        return res.status(500).json({ error: 'Image generation failed' });
        
      case 'generating':
        console.log(`⏳ Generation IN PROGRESS for prompt: "${prompt}" - waiting...`);
        // Wait and poll for completion
        return await waitForGenerationCompletion(generationStatus.id, res);
        
      case 'pending':
        console.log(`🚀 Starting NEW generation for prompt: "${prompt}" (${generationStatus.totalRequests} requests queued)`);
        // Start generation process
        return await startGenerationProcess(generationStatus.id, prompt, dimensions, format, userId, apiKeyData, res);
        
      default:
        console.error(`Unknown generation status: ${generationStatus.status}`);
        return res.status(500).json({ error: 'Unknown generation status' });
    }
    
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: 'Image generation failed' });
  }
});

// Function to wait for generation completion
async function waitForGenerationCompletion(statusId, res) {
  const maxWaitTime = 30000; // 30 seconds max wait
  const pollInterval = 1000; // Poll every 1 second
  let waitTime = 0;
  
  while (waitTime < maxWaitTime) {
    const status = imageQueue.getGenerationStatusById(statusId);
    
    if (!status) {
      console.error('Failed to get generation status');
      return res.status(500).json({ error: 'Failed to check generation status' });
    }
    
    if (status.status === 'completed') {
      console.log(`✅ Generation completed after ${waitTime}ms wait`);
      return res.redirect(status.generatedUrl);
    }
    
    if (status.status === 'failed') {
      console.log(`❌ Generation failed after ${waitTime}ms wait`);
      return res.status(500).json({ error: status.errorMessage || 'Image generation failed' });
    }
    
    // Still generating, wait and poll again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    waitTime += pollInterval;
  }
  
  // Timeout
  console.log(`⏰ Generation timeout after ${maxWaitTime}ms`);
  return res.status(504).json({ error: 'Generation timeout - please try again' });
}

// Function to start generation process
async function startGenerationProcess(statusId, prompt, dimensions, format, userId, apiKeyData, res) {
  try {
    // Update status to 'generating' (JavaScript queue)
    imageQueue.updateGenerationStatus(statusId, 'generating');
    
    console.log(`🎨 Starting image generation for prompt: "${prompt}"`);
    const startTime = Date.now();
    
    // Generate new image (this is where you'd call FAL AI or your image generation service)
    // For now, simulate generation time with a delay
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate 2 second generation
    
    // For now, return a placeholder image URL
    // In production, you would integrate with FAL AI or another image generation service
    const generatedUrl = `https://via.placeholder.com/${dimensions.replace('x', 'x')}/6366f1/ffffff?text=${encodeURIComponent(prompt)}`;
    
    const generationTime = Date.now() - startTime;
    
    // Update status to 'completed' (JavaScript queue)
    imageQueue.updateGenerationStatus(statusId, 'completed', generatedUrl);
    
    console.log(`✅ Generation completed in ${generationTime}ms for prompt: "${prompt}"`);
    
    // Store in cache for future requests (JavaScript queue)
    imageQueue.storeCachedImage(prompt, dimensions, format, generatedUrl);
    console.log(`💾 Cached generated image for prompt: "${prompt}"`);
    
    // Log the generation if user is authenticated
    if (userId) {
      try {
        await SupabaseService.logImageGeneration(
          userId, 
          apiKeyData?.id,
          prompt, 
          dimensions, 
          true
        );
      } catch (logError) {
        console.error('Error logging generation:', logError);
      }
    }
    
    return res.redirect(generatedUrl);
    
  } catch (error) {
    console.error('Error in generation process:', error);
    
    // Update status to 'failed'
    await SupabaseService.updateGenerationStatus(
      statusId, 
      'failed', 
      null, 
      error.message, 
      null, 
      null
    );
    
    return res.status(500).json({ error: 'Image generation failed' });
  }
}

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: https://vrccim.com/health`);
    if (supabase) {
      console.log(`🔐 Authentication: Enabled`);
    } else {
      console.log(`⚠️  Authentication: Disabled`);
    }
  });
}

module.exports = app;