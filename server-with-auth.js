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

try {
  const { supabase: supabaseClient, SupabaseService: SupabaseServiceClass } = require('./supabase-config');
  supabase = supabaseClient;
  SupabaseService = SupabaseServiceClass;
  
  if (supabase && SupabaseService) {
    console.log('✅ Supabase initialized successfully');
  } else {
    console.warn('⚠️  Supabase client is null - environment variables may be missing');
  }
} catch (error) {
  console.warn('⚠️  Supabase initialization failed:', error.message);
  console.warn('Authentication features will be disabled');
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
      success: true,
      user: data.user,
      profile: profile
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
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    if (supabase) {
      console.log(`🔐 Authentication: Enabled`);
    } else {
      console.log(`⚠️  Authentication: Disabled`);
    }
  });
}

module.exports = app;