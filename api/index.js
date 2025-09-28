require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

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
  const { v4: uuidv4 } = require('uuid');
  
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
  }
  
  SupabaseService = SimplifiedSupabaseService;
  
  console.log('✅ Simplified SupabaseService created');
}

// Health check endpoint (simple, no dependencies)
app.get('/health', (req, res) => {
  try {
    res.json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        hasSupabase: !!supabase,
        hasStripe: !!process.env.STRIPE_SECRET_KEY,
        supabaseUrl: process.env.SUPABASE_URL ? 'Set' : 'Missing',
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing'
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Simple test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Function is working!', 
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path
  });
});

// Debug endpoint
app.get('/debug', (req, res) => {
  try {
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
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: 'Debug endpoint failed', details: error.message });
  }
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

// Update user profile
app.put('/api/user/profile', async (req, res) => {
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
    
    // Update profile in database
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ 
        full_name: name,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      profile: data
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
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

// Change password endpoint
app.post('/api/user/change-password', async (req, res) => {
  try {
    if (!supabase) {
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

    const { current_password, new_password } = req.body;
    
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    // Update password using Supabase auth
    const { data, error: updateError } = await supabase.auth.updateUser({
      password: new_password
    });

    if (updateError) {
      console.error('Error updating password:', updateError);
      return res.status(400).json({ error: updateError.message || 'Failed to update password' });
    }

    res.json({ 
      success: true, 
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
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

// Image generation endpoint (placeholder - returns a simple placeholder image)
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
    if (api_key) {
      const apiKeyData = await SupabaseService.validateApiKey(api_key);
      if (!apiKeyData) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
      userId = apiKeyData.user_id;
    }

    const prompt = text || `A beautiful ${w}x${h} placeholder image`;
    
    // For now, return a placeholder image URL
    // In production, you would integrate with FAL AI or another image generation service
    const placeholderUrl = `https://via.placeholder.com/${w}x${h}/6366f1/ffffff?text=${encodeURIComponent(prompt)}`;
    
    // Log the generation if user is authenticated
    if (userId) {
      try {
        await SupabaseService.logImageGeneration(
          userId, 
          api_key ? (await SupabaseService.validateApiKey(api_key))?.id : null,
          prompt, 
          `${w}x${h}`, 
          true
        );
      } catch (logError) {
        console.error('Error logging generation:', logError);
      }
    }

    res.redirect(placeholderUrl);
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: 'Image generation failed' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  console.error('Error Stack:', err.stack);
  
  // Don't leak error details in production
  const errorResponse = {
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message, stack: err.stack })
  };
  
  res.status(500).json(errorResponse);
});

// 404 handler
app.use((req, res) => {
  console.log('404 - Route not found:', req.path);
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Wrap everything in try-catch for better error handling
try {
  if (require.main === module) {
    app.listen(PORT, () => {
      console.log(`🚀 Server running`);
      console.log(`📊 Health check: https://vrccim.com/health`);
      if (supabase) {
        console.log(`🔐 Authentication: Enabled`);
      } else {
        console.log(`⚠️  Authentication: Disabled`);
      }
    });
  }

  module.exports = app;
} catch (error) {
  console.error('❌ Critical error during module initialization:', error);
  console.error('Error stack:', error.stack);
  
  // Export a minimal error handler
  const errorApp = express();
  errorApp.use((req, res) => {
    res.status(500).json({ 
      error: 'Server initialization failed', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  });
  
  module.exports = errorApp;
}