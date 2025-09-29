// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const express = require('express');
const axios = require('axios');
const sharp = require('sharp');
const NodeCache = require('node-cache');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const { fal } = require('@fal-ai/client');
const { supabase, supabaseClient, SupabaseService } = require('./supabase-config');
const StripeService = new (require('./stripe-config'))();
const ResendService = require('./resend-config');

const app = express();
const PORT = process.env.PORT || 3000;

// Debug environment variables
console.log('🔍 Environment Variables Debug:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing');
console.log('FAL_KEY:', process.env.FAL_KEY ? 'Set' : 'Missing');
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'Set' : 'Missing');

// Cache for generated images (24 hour TTL)
const imageCache = new NodeCache({ stdTTL: 86400 });

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'User-Agent']
}));

// Stripe Webhook Handler - must be before express.json() middleware
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!StripeService.isConfigured) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const signature = req.headers['stripe-signature'];
    
    // Check if webhook secret is configured
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    
    // Ensure we have the raw body as a Buffer for signature verification
    let rawBody = req.body;
    if (Buffer.isBuffer(rawBody)) {
      rawBody = rawBody.toString('utf8');
    }
    
    console.log('Webhook signature:', signature);
    console.log('Raw body type:', typeof rawBody);
    console.log('Raw body length:', rawBody.length);
    
    const event = StripeService.verifyWebhookSignature(rawBody, signature);

    console.log('Stripe webhook event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(400).json({ error: 'Webhook error', details: error.message });
  }
});

app.use(express.json());
app.use(express.static('public'));

// FAL AI Configuration
const FAL_KEY = process.env.FAL_KEY || '789ca5d1-1581-44e1-89c5-c2a91f6e26f3:1e7597e245d48ad2f5a521334a140e32';

// Configure FAL AI client
fal.config({
  credentials: FAL_KEY
});

// Generate image using FAL AI Seedream v4
async function generateImageWithFAL(prompt, width = 1024, height = 1024) {
  try {
    console.log(`Generating image with Seedream v4: "${prompt}"`);

    const result = await fal.subscribe("fal-ai/bytedance/seedream/v4/text-to-image", {
      input: {
        prompt: prompt,
        image_size: {
          width: width,
          height: height
        },
        num_images: 1,
        max_images: 1,
        enable_safety_checker: false, // Disable safety checker for NSFW content
        sync_mode: false // Get URLs instead of data URIs for better performance
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log('Seedream v4 Status:', update.logs?.map((log) => log.message).join(', '));
        }
      }
    });

    console.log('Seedream v4 Result:', result);

    // Seedream v4 response structure: result.data.images or result.images
    const images = result.data?.images || result.images;

    if (images && images.length > 0) {
      const image = images[0];
      console.log('First image object:', image);

      // Seedream v4 uses 'url' property for the image URL
      const imageUrl = image.url;

      if (imageUrl) {
        console.log('Found Seedream v4 image URL:', imageUrl);
        return imageUrl;
      } else {
        console.log('No URL found in Seedream v4 image object:', Object.keys(image));
        throw new Error('No image URL found in Seedream v4 response');
      }
    } else {
      console.log('No images found in Seedream v4 result. Result structure:', JSON.stringify(result, null, 2));
      throw new Error('No image generated by Seedream v4');
    }
  } catch (error) {
    console.error('Seedream v4 Error:', error);
    throw error;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      fal: !!FAL_KEY,
      supabase: !!supabase,
      stripe: StripeService.isConfigured
    }
  });
});

// Serve static pages
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

// Handle OPTIONS requests for CORS
app.options('*', (req, res) => {
  res.status(200).end();
});

// Authentication API Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    // Check if email is verified
    if (!data.user.email_confirmed_at) {
      return res.status(401).json({ 
        error: 'Email not verified',
        requires_verification: true 
      });
    }

    // Get or create user profile
    const profile = await SupabaseService.getOrCreateUserProfile(data.user);

    res.json({
      token: data.session.access_token,
      user: profile
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (data.user && !data.user.email_confirmed_at) {
      // Generate a 6-digit verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store the verification code temporarily (you might want to use Redis or database for production)
      // For now, we'll use a simple in-memory store
      if (!global.verificationCodes) {
        global.verificationCodes = new Map();
      }
      global.verificationCodes.set(email, {
        code: verificationCode,
        expires: Date.now() + 10 * 60 * 1000 // 10 minutes
      });

      // Send verification email using Resend
      try {
        await ResendService.sendVerificationEmail(email, verificationCode);
        console.log(`Verification email sent to ${email}`);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Continue anyway - user can still verify manually
      }

      return res.status(201).json({ 
        message: 'Account created. Please check your email for verification.',
        requires_verification: true 
      });
    }

    res.status(201).json({ 
      message: 'Account created successfully',
      token: data.session?.access_token 
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    // Check our custom verification code
    if (!global.verificationCodes) {
      return res.status(400).json({ error: 'No verification code found' });
    }

    const storedData = global.verificationCodes.get(email);
    if (!storedData) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Check if code has expired
    if (Date.now() > storedData.expires) {
      global.verificationCodes.delete(email);
      return res.status(400).json({ error: 'Verification code has expired' });
    }

    // Check if code matches
    if (storedData.code !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Code is valid, now verify with Supabase using admin API
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('Error listing users:', listError);
      return res.status(500).json({ error: 'Failed to verify email' });
    }

    const user = users.users.find(u => u.email === email);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Update user to confirm email
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );

    if (updateError) {
      console.error('Supabase verification error:', updateError);
      return res.status(400).json({ error: 'Failed to verify email' });
    }

    // Clean up the verification code
    global.verificationCodes.delete(email);

    // Create a session for the user
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email
    });

    if (sessionError) {
      console.error('Session creation error:', sessionError);
      return res.status(200).json({ 
        message: 'Email verified successfully. Please login.',
        redirect_to_login: true 
      });
    }

    // Get or create user profile
    const profile = await SupabaseService.getOrCreateUserProfile(updateData.user);

    res.json({
      token: sessionData.properties?.access_token || 'verified',
      user: profile,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Generate a new 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store the verification code temporarily
    if (!global.verificationCodes) {
      global.verificationCodes = new Map();
    }
    global.verificationCodes.set(email, {
      code: verificationCode,
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    // Send verification email using Resend
    try {
      await ResendService.sendVerificationEmail(email, verificationCode);
      console.log(`Verification email resent to ${email}`);
      res.json({ message: 'Verification email sent' });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      res.status(500).json({ error: 'Failed to send verification email' });
    }
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${req.protocol}://${req.get('host')}/reset-password.html`
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { password, token } = req.body;

    if (!password || !token) {
      return res.status(400).json({ error: 'Password and token are required' });
    }

    const { data, error } = await supabaseClient.auth.updateUser({
      password
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API Routes for authentication and user management
app.get('/api/user/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const profile = await SupabaseService.getOrCreateUserProfile(user);

    // Get total generations count from image_generations table
    const { count: totalGenerations } = await supabase
      .from('image_generations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Add total_generations to profile
    profile.total_generations = totalGenerations || 0;

    res.json(profile);
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
app.put('/api/user/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
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
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: apiKeys, error: apiError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (apiError) {
      throw apiError;
    }

    res.json({ api_keys: apiKeys });
  } catch (error) {
    console.error('Error getting API keys:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/user/image-generations', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: generations, error: genError } = await supabase
      .from('image_generations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (genError) {
      throw genError;
    }

    res.json({ generations });
  } catch (error) {
    console.error('Error getting image generations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create API key endpoint
app.post('/api/create-key', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Ensure user profile exists in the users table
    const profile = await SupabaseService.getOrCreateUserProfile(user);
    if (!profile) {
      return res.status(500).json({ error: 'Failed to create user profile' });
    }

    // Ensure user exists in users table (for foreign key constraint)
    // Since profiles.id = auth.users.id, we need to create a users record with the same ID
    const { data: existingUser, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (userCheckError && userCheckError.code === 'PGRST116') {
      // User doesn't exist in users table, create it with data from profile
      const { error: createUserError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email || profile.email || '',
          name: user.user_metadata?.full_name || profile.full_name || '',
          password: '', // No password needed as auth is handled by Supabase Auth
          email_verified: user.email_confirmed_at ? true : false,
          credits: profile.credits || 0,
          total_generations: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (createUserError) {
        // If it's a duplicate key error, the user already exists, which is fine
        if (createUserError.code === '23505') {
          console.log('User already exists in users table, continuing...');
        } else {
          console.error('Error creating user record:', createUserError);
          return res.status(500).json({ error: 'Failed to create user record' });
        }
      }
    } else if (userCheckError) {
      console.error('Error checking user:', userCheckError);
      return res.status(500).json({ error: 'Failed to verify user' });
    }

    const { v4: uuidv4 } = require('uuid');
    const apiKey = uuidv4() + '-' + Math.random().toString(36).substr(2, 8);

    const { data, error: insertError } = await supabase
      .from('api_keys')
      .insert({
        user_id: user.id,
        api_key: apiKey,
        name: 'Default API Key'
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    res.json({ 
      api_key: data.api_key,
      credits: 5 // Default credits for new API key
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stripe Configuration Endpoint
app.get('/api/stripe/config', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null
  });
});

// Subscription Management Endpoints
app.get('/api/subscription/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    // Get active subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    res.json({
      user: profile,
      subscription: subscription || null
    });
  } catch (error) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create subscription checkout session
app.post('/api/subscription/create-checkout', async (req, res) => {
  try {
    if (!StripeService.isConfigured) {
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { planType, successUrl, cancelUrl } = req.body;

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    // Create or get Stripe customer
    let customer = await StripeService.createOrGetCustomer(user.email, user.id);

    // Update profile with Stripe customer ID if not set
    if (!profile.stripe_customer_id) {
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customer.id })
        .eq('id', user.id);
    }

    // Get price ID based on plan type
    const { data: prices, error: priceError } = await supabase
      .from('stripe_prices')
      .select('price_id')
      .eq('plan_type', planType)
      .single();

    if (priceError || !prices) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    // Create checkout session
    const session = await StripeService.createSubscriptionCheckout(
      customer.id,
      prices.price_id,
      successUrl,
      cancelUrl
    );

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create refill checkout session
app.post('/api/subscription/create-refill-checkout', async (req, res) => {
  try {
    if (!StripeService.isConfigured) {
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { successUrl, cancelUrl } = req.body;

    // Check if user has active subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return res.status(400).json({ error: 'Active subscription required for credit refills' });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    // Get refill price ID
    const { data: prices, error: priceError } = await supabase
      .from('stripe_prices')
      .select('price_id')
      .eq('plan_type', 'refill')
      .single();

    if (priceError || !prices) {
      return res.status(400).json({ error: 'Refill option not available' });
    }

    // Create checkout session
    const session = await StripeService.createRefillCheckout(
      profile.stripe_customer_id,
      prices.price_id,
      successUrl,
      cancelUrl
    );

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating refill checkout session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upgrade subscription
app.post('/api/subscription/upgrade', async (req, res) => {
  try {
    if (!StripeService.isConfigured) {
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get current subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    if (subscription.plan_type === 'premium') {
      return res.status(400).json({ error: 'Already on premium plan' });
    }

    // Get premium price ID
    const { data: prices, error: priceError } = await supabase
      .from('stripe_prices')
      .select('price_id')
      .eq('plan_type', 'premium')
      .single();

    if (priceError || !prices) {
      return res.status(400).json({ error: 'Premium plan not available' });
    }

    // Update Stripe subscription
    const updatedSubscription = await StripeService.updateSubscription(
      subscription.stripe_subscription_id,
      prices.price_id
    );

    // Update local subscription record
    await supabase
      .from('subscriptions')
      .update({
        plan_type: 'premium',
        price_id: prices.price_id,
        current_period_start: new Date(updatedSubscription.current_period_start * 1000),
        current_period_end: new Date(updatedSubscription.current_period_end * 1000)
      })
      .eq('id', subscription.id);

    // Add difference in credits (200 credits)
    await supabase.rpc('add_credits', {
      p_user_id: user.id,
      p_amount: 200,
      p_description: 'Upgrade to Premium Plan - Credit Difference',
      p_subscription_id: subscription.id
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Downgrade subscription
app.post('/api/subscription/downgrade', async (req, res) => {
  try {
    if (!StripeService.isConfigured) {
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get current subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    if (subscription.plan_type === 'basic') {
      return res.status(400).json({ error: 'Already on basic plan' });
    }

    // Get basic price ID
    const { data: prices, error: priceError } = await supabase
      .from('stripe_prices')
      .select('price_id')
      .eq('plan_type', 'basic')
      .single();

    if (priceError || !prices) {
      return res.status(400).json({ error: 'Basic plan not available' });
    }

    // Update Stripe subscription
    const updatedSubscription = await StripeService.updateSubscription(
      subscription.stripe_subscription_id,
      prices.price_id
    );

    // Update local subscription record
    await supabase
      .from('subscriptions')
      .update({
        plan_type: 'basic',
        price_id: prices.price_id,
        current_period_start: new Date(updatedSubscription.current_period_start * 1000),
        current_period_end: new Date(updatedSubscription.current_period_end * 1000)
      })
      .eq('id', subscription.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error downgrading subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel subscription
app.post('/api/subscription/cancel', async (req, res) => {
  try {
    if (!StripeService.isConfigured) {
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get current subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Cancel Stripe subscription
    await StripeService.cancelSubscription(subscription.stripe_subscription_id);

    // Update local subscription record
    await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        cancel_at_period_end: true
      })
      .eq('id', subscription.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get session details
app.get('/api/subscription/session-details', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { session_id } = req.query;
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // Get session details from Stripe
    const session = await StripeService.stripe.checkout.sessions.retrieve(session_id);
    
    if (session.metadata.type === 'subscription') {
      const subscription = await StripeService.stripe.subscriptions.retrieve(session.subscription);
      const planType = subscription.items.data[0].price.metadata.plan_type;
      
      res.json({
        type: 'subscription',
        planType: planType,
        credits: planType === 'premium' ? 300 : 100,
        amount: (session.amount_total / 100).toFixed(2),
        nextBillingDate: new Date(subscription.current_period_end * 1000)
      });
    } else if (session.metadata.type === 'refill') {
      res.json({
        type: 'refill',
        credits: 35,
        amount: (session.amount_total / 100).toFixed(2)
      });
    } else {
      res.json({
        type: 'unknown',
        amount: (session.amount_total / 100).toFixed(2)
      });
    }
  } catch (error) {
    console.error('Error getting session details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Webhook handlers
async function handleCheckoutSessionCompleted(session) {
  try {
    console.log('Processing checkout session completed:', session.id);

    if (session.mode === 'subscription') {
      const subscription = await StripeService.stripe.subscriptions.retrieve(session.subscription);
      const customer = await StripeService.stripe.customers.retrieve(session.customer);
      
      console.log('Customer email:', customer.email);
      console.log('Subscription ID:', subscription.id);
      
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', customer.email)
        .single();

      if (profileError || !profile) {
        console.error('User not found for email:', customer.email, 'Error:', profileError);
        return;
      }

      console.log('Found user profile:', profile.id);

      const planType = subscription.items.data[0].price.metadata.plan_type;
      let credits = parseInt(subscription.items.data[0].price.metadata.credits);
      
      // Fallback: if credits not in metadata, use plan type to determine credits
      if (isNaN(credits) || credits <= 0) {
        console.log('Credits not found in price metadata, using plan type fallback');
        credits = planType === 'premium' ? 300 : 100;
      }
      
      console.log('Plan type:', planType, 'Credits:', credits);
      console.log('Subscription current_period_start:', subscription.current_period_start);
      console.log('Subscription current_period_end:', subscription.current_period_end);

      // Create subscription record
      const { data: newSubscription, error: subError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: profile.id,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customer.id,
          status: subscription.status,
          plan_type: planType,
          price_id: subscription.items.data[0].price.id,
          current_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000) : new Date(),
          current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        })
        .select()
        .single();

      if (subError) {
        console.error('Error creating subscription record:', subError);
        return;
      }

      console.log('Subscription record created:', newSubscription.id);

      // Add credits to user account
      console.log('Adding credits to user account...');
      const { data: addCreditsResult, error: addCreditsError } = await supabase.rpc('add_credits', {
        p_user_id: profile.id,
        p_amount: credits,
        p_description: `${planType === 'premium' ? 'Premium' : 'Basic'} Plan - Monthly Credits`,
        p_subscription_id: newSubscription.id
      });

      if (addCreditsError) {
        console.error('Error adding credits:', addCreditsError);
        throw addCreditsError; // Re-throw to trigger webhook error response
      }

      console.log('Credits added successfully');

      // Update user's credit expiration
      await supabase
        .from('profiles')
        .update({
          credits_expire_at: new Date(subscription.current_period_end * 1000)
        })
        .eq('id', profile.id);

      console.log('Subscription created successfully for user:', profile.email);
    } else if (session.mode === 'payment') {
      // Handle one-time payment (credit refill)
      const customer = await StripeService.stripe.customers.retrieve(session.customer);
      
      console.log('Processing credit refill for customer:', customer.email);
      
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', customer.email)
        .single();

      if (profileError || !profile) {
        console.error('User not found for email:', customer.email, 'Error:', profileError);
        return;
      }

      console.log('Found user profile for refill:', profile.id);

      // Add refill credits
      console.log('Adding refill credits...');
      const { data: addCreditsResult, error: addCreditsError } = await supabase.rpc('add_credits', {
        p_user_id: profile.id,
        p_amount: 35,
        p_description: 'Credit Refill - 35 Credits',
        p_stripe_payment_intent_id: session.payment_intent
      });

      if (addCreditsError) {
        console.error('Error adding refill credits:', addCreditsError);
        throw addCreditsError; // Re-throw to trigger webhook error response
      }

      console.log('Credit refill processed successfully for user:', profile.email);
    }
  } catch (error) {
    console.error('Error handling checkout session completed:', error);
  }
}

async function handleSubscriptionUpdated(subscription) {
  try {
    console.log('Processing subscription updated:', subscription.id);

    // Update subscription record
    await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000),
        cancel_at_period_end: subscription.cancel_at_period_end
      })
      .eq('stripe_subscription_id', subscription.id);

    console.log('Subscription updated successfully');
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

async function handleSubscriptionDeleted(subscription) {
  try {
    console.log('Processing subscription deleted:', subscription.id);

    // Update subscription record
    await supabase
      .from('subscriptions')
      .update({
        status: 'canceled'
      })
      .eq('stripe_subscription_id', subscription.id);

    console.log('Subscription canceled successfully');
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

async function handleInvoicePaymentSucceeded(invoice) {
  try {
    console.log('Processing invoice payment succeeded:', invoice.id);

    if (invoice.subscription) {
      const subscription = await StripeService.stripe.subscriptions.retrieve(invoice.subscription);
      const customer = await StripeService.stripe.customers.retrieve(invoice.customer);
      
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', customer.email)
        .single();

      if (profileError || !profile) {
        console.error('User not found for email:', customer.email);
        return;
      }

      // Get subscription record
      const { data: subRecord, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('stripe_subscription_id', subscription.id)
        .single();

      if (subError || !subRecord) {
        console.error('Subscription record not found:', subscription.id);
        return;
      }

      // Get credits from price metadata or fallback to plan type
      let credits = parseInt(subscription.items.data[0].price.metadata.credits);
      
      // Fallback: if credits not in metadata, use plan type to determine credits
      if (isNaN(credits) || credits <= 0) {
        console.log('Credits not found in price metadata, using plan type fallback');
        credits = subRecord.plan_type === 'premium' ? 300 : 100;
      }
      
      console.log('Adding monthly renewal credits:', credits, 'for user:', profile.email, 'plan:', subRecord.plan_type);

      // Add monthly credits
      const { data: addCreditsResult, error: addCreditsError } = await supabase.rpc('add_credits', {
        p_user_id: profile.id,
        p_amount: credits,
        p_description: `${subRecord.plan_type === 'premium' ? 'Premium' : 'Basic'} Plan - Monthly Renewal`,
        p_subscription_id: subRecord.id
      });

      if (addCreditsError) {
        console.error('Error adding monthly renewal credits:', addCreditsError);
        throw addCreditsError; // Re-throw to trigger webhook error response
      }

      // Update credit expiration
      await supabase
        .from('profiles')
        .update({
          credits_expire_at: new Date(subscription.current_period_end * 1000)
        })
        .eq('id', profile.id);

      console.log('Monthly credits added for user:', profile.email);
    }
  } catch (error) {
    console.error('Error handling invoice payment succeeded:', error);
  }
}

async function handleInvoicePaymentFailed(invoice) {
  try {
    console.log('Processing invoice payment failed:', invoice.id);

    if (invoice.subscription) {
      // Update subscription status to past_due
      await supabase
        .from('subscriptions')
        .update({
          status: 'past_due'
        })
        .eq('stripe_subscription_id', invoice.subscription);

      console.log('Subscription marked as past due');
    }
  } catch (error) {
    console.error('Error handling invoice payment failed:', error);
  }
}

// Image generation endpoint with credit checking
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
      const { data: apiKeyData, error: apiError } = await supabase
        .from('api_keys')
        .select('user_id, is_active')
        .eq('api_key', api_key)
        .single();

      if (apiError || !apiKeyData || !apiKeyData.is_active) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      userId = apiKeyData.user_id;
    }

    const prompt = text || `A beautiful ${w}x${h} placeholder image`;
    const cacheKey = `${w}x${h}-${format}-${encodeURIComponent(prompt)}`;

    // Check cache first
    const cachedImage = imageCache.get(cacheKey);
    if (cachedImage) {
      console.log('Serving cached image');
      return res.redirect(cachedImage);
    }

    // Check credits if user is authenticated
    if (userId) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('credits, credits_expire_at')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error checking user credits:', profileError);
        return res.status(500).json({ error: 'Internal server error' });
      }

      // Check if credits have expired
      if (profile.credits_expire_at && new Date(profile.credits_expire_at) < new Date()) {
        return res.status(402).json({ error: 'Credits expired. Please renew your subscription.' });
      }

      if (profile.credits < 1) {
        return res.status(402).json({ error: 'Insufficient credits. Please purchase more credits.' });
      }

      // Use credits
      const creditUsed = await supabase.rpc('use_credits', {
        p_user_id: userId,
        p_amount: 1,
        p_description: `Image generation: ${w}x${h} - ${prompt}`
      });

      if (!creditUsed.data) {
        return res.status(402).json({ error: 'Failed to deduct credits' });
      }
    }

    // Generate image
    console.log(`Generating ${w}x${h} image with prompt: "${prompt}"`);
    const imageUrl = await generateImageWithFAL(prompt, w, h);

    // Cache the result
    imageCache.set(cacheKey, imageUrl);

    // Log the generation
    if (userId) {
      const { data: apiKeyData } = await supabase
        .from('api_keys')
        .select('id')
        .eq('api_key', api_key)
        .single();

      const { data: insertData, error: insertError } = await supabase
        .from('image_generations')
        .insert({
          user_id: userId,
          api_key_id: apiKeyData?.id,
          prompt: prompt,
          dimensions: `${w}x${h}`,
          success: true,
          public_url: imageUrl
        });

      if (insertError) {
        console.error('Error logging image generation:', insertError);
      } else {
        console.log('Successfully logged image generation:', insertData);
      }

      // Note: total_generations will be calculated dynamically from image_generations table
      console.log('Image generation completed and logged successfully');

      // Update API key usage
      if (apiKeyData) {
        // First get current total_requests
        const { data: currentData } = await supabase
          .from('api_keys')
          .select('total_requests')
          .eq('id', apiKeyData.id)
          .single();

        const newTotalRequests = (currentData?.total_requests || 0) + 1;

        await supabase
          .from('api_keys')
          .update({
            last_used_at: new Date(),
            total_requests: newTotalRequests
          })
          .eq('id', apiKeyData.id);
      }
    }

    res.redirect(imageUrl);
  } catch (error) {
    console.error('Image generation error:', error);
    
    // Log failed generation if user is authenticated
    if (req.user && req.user.id) {
      try {
        await supabase
          .from('image_generations')
          .insert({
            user_id: req.user.id,
            prompt: req.query.text || 'Unknown',
            dimensions: `${req.params.width}x${req.params.height}`,
            credits_used: 0,
            success: false,
            error_message: error.message
          });
      } catch (logError) {
        console.error('Error logging failed generation:', logError);
      }
    }

    res.status(500).json({ error: 'Image generation failed' });
  }
});

// Helper: slugify prompt for stable storage paths
function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'prompt';
}

// Video generation endpoint (mp4) - 30 second loop of generated image
app.get('/:width(\\d+)x:height(\\d+).mp4', async (req, res) => {
  try {
    const { width, height } = req.params;
    const { text, api_key, seconds } = req.query;

    const w = parseInt(width);
    const h = parseInt(height);
    const duration = Math.min(30, Math.max(1, parseInt(seconds || '30'))); // default 30s, cap 30s

    if (w < 1 || w > 2048 || h < 1 || h > 2048) {
      return res.status(400).json({ error: 'Invalid dimensions. Must be between 1x1 and 2048x2048' });
    }

    // Check API key if provided
    let userId = null;
    let apiKeyRecord = null;
    if (api_key) {
      const { data: apiKeyData, error: apiError } = await supabase
        .from('api_keys')
        .select('id, user_id, is_active')
        .eq('api_key', api_key)
        .single();

      if (apiError || !apiKeyData || !apiKeyData.is_active) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      userId = apiKeyData.user_id;
      apiKeyRecord = apiKeyData;
    }

    const prompt = text || `A beautiful ${w}x${h} placeholder image`;
    const cacheKey = `${w}x${h}-mp4-${encodeURIComponent(prompt)}-${duration}`;

    // First: check Supabase Storage cache to avoid rework & API calls
    const bucket = process.env.SUPABASE_VIDEO_BUCKET || 'generated-videos';
    const fileName = `${slugify(prompt)}_${duration}s.mp4`;
    const dir = `${w}x${h}`;
    const storagePath = `${dir}/${fileName}`;
    try {
      const list = await supabase.storage.from(bucket).list(dir, { search: fileName, limit: 1 });
      if (!list.error && list.data && list.data.find(f => f.name === fileName)) {
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(storagePath);
        if (pub?.publicUrl) {
          return res.redirect(pub.publicUrl);
        }
      }
    } catch (e) {
      console.warn('Storage pre-check skipped or failed:', e.message);
    }

    // Small cache: reuse generated image URL so we don't regenerate
    let imageUrl = imageCache.get(cacheKey);
    if (!imageUrl) {
      // Check credits if user is authenticated
      if (userId) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('credits, credits_expire_at')
          .eq('id', userId)
          .single();

        if (profileError) {
          console.error('Error checking user credits (video):', profileError);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (profile.credits_expire_at && new Date(profile.credits_expire_at) < new Date()) {
          return res.status(402).json({ error: 'Credits expired. Please renew your subscription.' });
        }

        if (profile.credits < 1) {
          return res.status(402).json({ error: 'Insufficient credits. Please purchase more credits.' });
        }

        // Deduct 1 credit
        const creditUsed = await supabase.rpc('use_credits', {
          p_user_id: userId,
          p_amount: 1,
          p_description: `Video generation: ${w}x${h} - ${prompt} (${duration}s)`
        });

        if (!creditUsed.data) {
          return res.status(402).json({ error: 'Failed to deduct credits' });
        }
      }

      // Generate the image first (only if not in storage)
      console.log(`Generating base image for video ${w}x${h}, prompt: "${prompt}"`);
      imageUrl = await generateImageWithFAL(prompt, w, h);
      imageCache.set(cacheKey, imageUrl);

      // Log generation
      if (userId) {
        try {
          await supabase
            .from('image_generations')
            .insert({
              user_id: userId,
              api_key_id: apiKeyRecord?.id,
              prompt: prompt,
              dimensions: `${w}x${h}`,
              success: true,
              public_url: imageUrl
            });

          // Update API key usage counter
          if (apiKeyRecord) {
            const { data: currentData } = await supabase
              .from('api_keys')
              .select('total_requests')
              .eq('id', apiKeyRecord.id)
              .single();

            const newTotalRequests = (currentData?.total_requests || 0) + 1;
            await supabase
              .from('api_keys')
              .update({ last_used_at: new Date(), total_requests: newTotalRequests })
              .eq('id', apiKeyRecord.id);
          }
        } catch (e) {
          console.error('Error logging video generation:', e);
        }
      }
    }

    // Download image then render to a temp MP4 file so duration metadata is correct
    let response;
    try {
      response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
    } catch (e) {
      console.error('Failed to download image for video:', e.message);
      return res.status(500).json({ error: 'Failed to fetch generated image' });
    }

    const outPath = path.join('/tmp', `vid_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`);
    const ffmpegArgs = [
      '-loglevel', 'info',
      '-nostdin',
      '-y',
      // Input 0: the still image via stdin
      '-f', 'image2pipe',
      '-i', 'pipe:0',
      // Input 1: a constant color video that defines duration and fps
      '-f', 'lavfi',
      '-t', String(duration),
      '-i', `color=c=black:s=${w}x${h}:r=30`,
      // Input 2: a silent audio track for compatibility
      '-f', 'lavfi',
      '-t', String(duration),
      '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      // Compose: scale image then overlay once at init, keep for full duration
      '-filter_complex', `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease[img];[1:v][img]overlay=(W-w)/2:(H-h)/2:eval=init,format=yuv420p[vid]`,
      // Map streams
      '-map', '[vid]',
      '-map', '2:a:0',
      // Encode
      '-c:v', 'libx264',
      '-profile:v', 'main',
      '-preset', 'veryfast',
      '-crf', '20',
      '-r', '30',
      '-c:a', 'aac',
      '-b:a', '128k',
      // Ensure final duration is exactly requested
      '-t', String(duration),
      '-movflags', '+faststart',
      outPath
    ];

    const ff = spawn('ffmpeg', ffmpegArgs);

    ff.on('error', (err) => {
      console.error('ffmpeg spawn error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Video generation failed (ffmpeg not available)' });
    });

    ff.stdin.write(Buffer.from(response.data));
    ff.stdin.end();

    ff.stderr.on('data', (d) => console.error('ffmpeg:', d.toString()));

    ff.on('close', async (code) => {
      try {
        if (code !== 0) {
          console.error('ffmpeg exited with code', code);
          if (!res.headersSent) return res.status(500).json({ error: 'Video generation failed' });
          return;
        }

        const fs = require('fs');
        // Upload to Supabase Storage for persistent caching
        try {
          const fs = require('fs');
          const fileBuffer = fs.readFileSync(outPath);
          const { error: upErr } = await supabase.storage
            .from(bucket)
            .upload(storagePath, fileBuffer, { contentType: 'video/mp4', upsert: true });
          if (upErr) {
            console.warn('Supabase upload error:', upErr.message || upErr);
          }
        } catch (uploadErr) {
          console.warn('Video upload exception:', uploadErr?.message);
        }

        const { data: pub2 } = supabase.storage.from(bucket).getPublicUrl(storagePath);
        const publicUrl = pub2?.publicUrl;

        // Stream the file now and then cleanup temp file
        try {
          const fs = require('fs');
          const stat = fs.statSync(outPath);
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Content-Length', String(stat.size));
          res.setHeader('Cache-Control', 'public, max-age=86400');
          if (publicUrl) res.setHeader('X-Cache-Location', publicUrl);

          const stream = fs.createReadStream(outPath);
          stream.pipe(res);
          stream.on('close', () => {
            fs.unlink(outPath, () => {});
          });
        } catch (streamErr) {
          console.error('Streaming temp video failed:', streamErr);
          if (!res.headersSent && publicUrl) {
            return res.redirect(publicUrl);
          }
        }
      } catch (e) {
        console.error('Error finalizing video response:', e);
        if (!res.headersSent) res.status(500).json({ error: 'Video generation failed' });
      }
    });
  } catch (error) {
    console.error('Video generation error:', error);
    res.status(500).json({ error: 'Video generation failed' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: https://vrccim.com/health`);
  console.log(`🎨 Image generator: https://vrccim.com/600x400.jpg?text=hello`);
  
  if (StripeService.isConfigured) {
    console.log(`💳 Stripe integration: Enabled`);
  } else {
    console.log(`⚠️  Stripe integration: Disabled (set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY)`);
  }
});

