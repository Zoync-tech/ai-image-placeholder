const express = require('express');
const axios = require('axios');
const sharp = require('sharp');
const NodeCache = require('node-cache');
const cors = require('cors');
const path = require('path');
const { fal } = require('@fal-ai/client');
const crypto = require('crypto');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3000;

// Cache for generated images (24 hour TTL)
const imageCache = new NodeCache({ stdTTL: 86400 });

// Simple in-memory storage for users and API keys (in production, use a database)
const users = new Map();
const apiKeys = new Map();
const sessions = new Map(); // For user sessions
const emailVerifications = new Map(); // For email verification codes

// Initialize with a default user for testing
const defaultUserId = 'user_' + crypto.randomUUID().substring(0, 8);
const defaultApiKey = 'ai_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);

users.set(defaultUserId, {
  id: defaultUserId,
  email: 'demo@example.com',
  name: 'Demo User',
  credits: 5,
  created_at: new Date().toISOString(),
  total_generations: 0
});

apiKeys.set(defaultApiKey, {
  id: defaultApiKey,
  user_id: defaultUserId,
  name: 'Demo API Key',
  is_active: true,
  created_at: new Date().toISOString(),
  total_requests: 0,
  last_used_at: null
});

console.log(`🔑 Demo API Key: ${defaultApiKey}`);
console.log(`📧 Demo User: ${defaultUserId} (5 credits)`);

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'User-Agent']
}));
app.use(express.json());
app.use(express.static('public'));

// FAL AI Configuration
const FAL_KEY = process.env.FAL_KEY || '789ca5d1-1581-44e1-89c5-c2a91f6e26f3:1e7597e245d48ad2f5a521334a140e32';

// Configure FAL AI client
fal.config({
  credentials: FAL_KEY
});

// Generate image using FAL AI Nano Banana (Gemini-powered)
async function generateImageWithFAL(prompt, width = 600, height = 400) {
  try {
    console.log(`Generating image with FAL AI: "${prompt}"`);
    
    const result = await fal.subscribe("fal-ai/nano-banana", {
      input: {
        prompt: prompt,
        num_images: 1,
        output_format: "jpeg",
        sync_mode: false
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log('FAL AI Status:', update.logs?.map((log) => log.message).join(', '));
        }
      },
    });

    console.log('FAL AI Result:', result.data);
    
    if (result.data && result.data.images && result.data.images[0] && result.data.images[0].url) {
      const imageResponse = await axios.get(result.data.images[0].url, {
        responseType: 'arraybuffer',
        timeout: 30000
      });
      
      return imageResponse.data;
    } else {
      throw new Error('No image URL returned from FAL AI');
    }
  } catch (error) {
    console.error('FAL AI Error:', error.message);
    throw new Error('Failed to generate image with FAL AI');
  }
}

// Main image generation function
async function generateImage(prompt, width = 600, height = 400) {
  try {
    console.log(`Generating image with FAL AI Nano Banana: "${prompt}"`);
    const imageBuffer = await generateImageWithFAL(prompt, width, height);
    
    if (imageBuffer && imageBuffer.length > 0) {
      console.log('✅ Image generated successfully');
      return imageBuffer;
    } else {
      throw new Error('Empty image buffer returned');
    }
  } catch (error) {
    console.error('Image generation failed:', error.message);
    throw new Error('Failed to generate image');
  }
}

// Resize image function
async function resizeImage(imageBuffer, width, height) {
  return await sharp(imageBuffer)
    .resize(width, height, {
      fit: 'cover',
      position: 'center'
    })
    .jpeg({ quality: 90 })
    .toBuffer();
}

// API Key validation
function validateApiKey(apiKey) {
  const keyData = apiKeys.get(apiKey);
  if (!keyData || !keyData.is_active) {
    return null;
  }
  
  const user = users.get(keyData.user_id);
  if (!user) {
    return null;
  }
  
  return { ...keyData, user };
}

// Deduct credits
function deductCredits(userId, credits = 1) {
  const user = users.get(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  if (user.credits < credits) {
    throw new Error('Insufficient credits');
  }
  
  user.credits -= credits;
  user.total_generations += 1;
  users.set(userId, user);
  
  return user.credits;
}

// Update API key stats
function updateApiKeyStats(apiKeyId) {
  const keyData = apiKeys.get(apiKeyId);
  if (keyData) {
    keyData.total_requests += 1;
    keyData.last_used_at = new Date().toISOString();
    apiKeys.set(apiKeyId, keyData);
  }
}

// Generate email verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
}

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY || 're_2hjEnGgj_FRr1Zi3CBZEDMmv5PXsYuvnZ');

// Send verification email using Resend
async function sendVerificationEmail(email, code) {
  try {
    console.log(`📧 Sending verification email to ${email} via Resend`);
    
    const { data, error } = await resend.emails.send({
      from: 'AI Image Placeholder <noreply@aiimageplaceholder.com>', // You can customize this with your domain
      to: [email],
      subject: 'Verify Your Email - AI Image Placeholder',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 32px; font-weight: 300;">🎨 AI Image Placeholder</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Email Verification</p>
          </div>
          
          <div style="background: white; padding: 40px; border: 1px solid #e1e5e9; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-bottom: 20px; font-size: 24px;">Verify Your Email Address</h2>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px; font-size: 16px;">
              Thank you for signing up! To complete your registration and access your dashboard, 
              please verify your email address using the code below:
            </p>
            
            <div style="background: #f8f9fa; border: 3px solid #667eea; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
              <div style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 4px; font-family: 'Courier New', monospace; margin-bottom: 10px;">
                ${code}
              </div>
              <p style="margin: 0; color: #666; font-size: 14px;">Enter this code on the verification page</p>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>⏰ Important:</strong> This code will expire in 10 minutes for security reasons.
              </p>
            </div>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 25px; font-size: 16px;">
              Once verified, you'll get:
            </p>
            
            <ul style="color: #333; line-height: 2; font-size: 16px; padding-left: 20px;">
              <li style="margin-bottom: 8px;">✅ <strong>5 free image generation credits</strong></li>
              <li style="margin-bottom: 8px;">✅ <strong>Personal API key</strong> for secure access</li>
              <li style="margin-bottom: 8px;">✅ <strong>Dashboard access</strong> and usage tracking</li>
              <li style="margin-bottom: 8px;">✅ <strong>VRChat-compatible</strong> image URLs</li>
            </ul>
            
            <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid #e1e5e9;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                If you didn't request this verification, please ignore this email.
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
        AI Image Placeholder - Email Verification
        
        Your verification code is: ${code}
        
        Enter this code on the verification page to complete your registration.
        
        This code expires in 10 minutes.
        
        Once verified, you'll get:
        - 5 free image generation credits
        - Personal API key for secure access
        - Access to your dashboard and usage tracking
        - VRChat-compatible image URLs
        
        If you didn't request this verification, please ignore this email.
      `
    });

    if (error) {
      throw new Error(`Resend API error: ${error.message}`);
    }

    console.log(`✅ Verification email sent successfully to ${email}`);
    console.log(`📧 Resend ID: ${data.id}`);
    return true;

  } catch (error) {
    console.error('❌ Failed to send verification email via Resend:', error.message);
    
    // Fallback: Log to console for development
    console.log(`📧 FALLBACK - Verification email for ${email}:`);
    console.log(`🔐 Verification code: ${code}`);
    console.log(`⏰ Code expires in 10 minutes`);
    console.log(`💡 Check RESEND_API_KEY environment variable`);
    
    return true; // Return true so signup still works
  }
}

// Verify email code
function verifyEmailCode(email, code) {
  const verification = emailVerifications.get(email);
  if (!verification) {
    return { success: false, error: 'No verification code found' };
  }
  
  // Check if code is expired (10 minutes)
  const now = new Date();
  const expirationTime = new Date(verification.created_at);
  expirationTime.setMinutes(expirationTime.getMinutes() + 10);
  
  if (now > expirationTime) {
    emailVerifications.delete(email);
    return { success: false, error: 'Verification code expired' };
  }
  
  if (verification.code !== code) {
    return { success: false, error: 'Invalid verification code' };
  }
  
  // Code is valid, mark email as verified
  emailVerifications.delete(email);
  return { success: true };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    mode: 'with-auth',
    total_users: users.size,
    total_api_keys: apiKeys.size,
    demo_api_key: defaultApiKey
  });
});

// Serve the demo page at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve auth page
app.get('/auth', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

// Serve verification page
app.get('/verify', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verify.html'));
});

// Serve dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard-simple.html'));
});

// Authentication endpoints
app.post('/api/auth/signup', (req, res) => {
  const { email, name } = req.body;
  
  if (!email || !name) {
    return res.status(400).json({
      error: 'Email and name are required'
    });
  }
  
  // Check if user already exists
  const existingUser = Array.from(users.values()).find(user => user.email === email);
  if (existingUser) {
    return res.status(400).json({
      error: 'User with this email already exists'
    });
  }
  
  // Generate verification code
  const verificationCode = generateVerificationCode();
  
  // Store verification code
  emailVerifications.set(email, {
    code: verificationCode,
    name: name,
    created_at: new Date().toISOString()
  });
  
  // Send verification email
  sendVerificationEmail(email, verificationCode);
  
  res.json({
    message: 'Please check your email for verification code',
    email: email,
    requires_verification: true
  });
});

// Email verification endpoint
app.post('/api/auth/verify-email', (req, res) => {
  const { email, code } = req.body;
  
  if (!email || !code) {
    return res.status(400).json({
      error: 'Email and verification code are required'
    });
  }
  
  // Verify the code
  const verification = verifyEmailCode(email, code);
  if (!verification.success) {
    return res.status(400).json({
      error: verification.error
    });
  }
  
  // Get user data from verification
  const verificationData = emailVerifications.get(email);
  const name = verificationData ? verificationData.name : 'User';
  
  // Create new user
  const userId = 'user_' + crypto.randomUUID().substring(0, 8);
  const user = {
    id: userId,
    email: email,
    name: name,
    email_verified: true,
    credits: 5, // 5 free credits
    created_at: new Date().toISOString(),
    total_generations: 0
  };
  
  users.set(userId, user);
  
  // Create default API key
  const apiKey = 'ai_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  const apiKeyData = {
    id: apiKey,
    user_id: userId,
    name: 'Default API Key',
    is_active: true,
    created_at: new Date().toISOString(),
    total_requests: 0,
    last_used_at: null
  };
  
  apiKeys.set(apiKey, apiKeyData);
  
  // Create session token
  const token = crypto.randomUUID();
  sessions.set(token, {
    user_id: userId,
    created_at: new Date().toISOString()
  });
  
  res.json({
    token: token,
    user: user,
    api_key: apiKey,
    message: 'Email verified successfully! Account created with 5 free credits.'
  });
});

// Resend verification code endpoint
app.post('/api/auth/resend-verification', (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      error: 'Email is required'
    });
  }
  
  // Check if verification already exists
  const existingVerification = emailVerifications.get(email);
  if (!existingVerification) {
    return res.status(400).json({
      error: 'No pending verification found for this email'
    });
  }
  
  // Generate new verification code
  const verificationCode = generateVerificationCode();
  
  // Update verification code
  emailVerifications.set(email, {
    code: verificationCode,
    name: existingVerification.name,
    created_at: new Date().toISOString()
  });
  
  // Send verification email
  sendVerificationEmail(email, verificationCode);
  
  res.json({
    message: 'New verification code sent to your email'
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      error: 'Email is required'
    });
  }
  
  // Find user by email
  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user) {
    return res.status(401).json({
      error: 'User not found. Please sign up first.'
    });
  }
  
  // Check if email is verified
  if (!user.email_verified) {
    return res.status(403).json({
      error: 'Email not verified. Please verify your email first.',
      requires_verification: true
    });
  }
  
  // Create session token
  const token = crypto.randomUUID();
  sessions.set(token, {
    user_id: user.id,
    created_at: new Date().toISOString()
  });
  
  res.json({
    token: token,
    user: user,
    message: 'Login successful'
  });
});

// Middleware to validate session token
function validateSession(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      error: 'No token provided'
    });
  }
  
  const session = sessions.get(token);
  if (!session) {
    return res.status(401).json({
      error: 'Invalid or expired token'
    });
  }
  
  req.userId = session.user_id;
  next();
}

// User profile endpoint
app.get('/api/user/profile', validateSession, (req, res) => {
  const user = users.get(req.userId);
  if (!user) {
    return res.status(404).json({
      error: 'User not found'
    });
  }
  
  res.json(user);
});

// API Routes for user management
app.get('/api/info', (req, res) => {
  const { api_key } = req.query;
  
  if (!api_key) {
    return res.status(401).json({
      error: 'API key required',
      message: 'Please provide an API key in the URL: ?api_key=your_api_key'
    });
  }
  
  const keyData = validateApiKey(api_key);
  if (!keyData) {
    return res.status(401).json({
      error: 'Invalid API key',
      message: 'The provided API key is invalid or inactive'
    });
  }
  
  res.json({
    api_key: api_key,
    user_id: keyData.user_id,
    credits_remaining: keyData.user.credits,
    total_generations: keyData.user.total_generations,
    api_key_name: keyData.name,
    api_key_requests: keyData.total_requests,
    last_used: keyData.last_used_at
  });
});

// Create new API key endpoint
app.post('/api/create-key', validateSession, (req, res) => {
  const { name = 'New API Key' } = req.body;
  
  const userId = req.userId;
  const apiKey = 'ai_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  
  apiKeys.set(apiKey, {
    id: apiKey,
    user_id: userId,
    name: name,
    is_active: true,
    created_at: new Date().toISOString(),
    total_requests: 0,
    last_used_at: null
  });
  
  const user = users.get(userId);
  
  res.json({
    api_key: apiKey,
    user_id: userId,
    name: name,
    credits: user.credits,
    message: 'API key created successfully!'
  });
});

// Handle OPTIONS requests for CORS
app.options('*', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, User-Agent'
  });
  res.status(200).end();
});

// Main route handler for image generation (with .jpg extension for VRChat)
app.get('/:dimensions.jpg', async (req, res) => {
  try {
    const { dimensions } = req.params;
    const { text, api_key } = req.query;
    
    console.log(`Image request: ${dimensions}.jpg, text: "${text}", api_key: ${api_key ? 'provided' : 'missing'}`);
    
    // Validate API key
    if (!api_key) {
      return res.status(401).json({
        error: 'API key required',
        message: 'Please provide an API key in the URL: ?api_key=your_api_key',
        example: `/${dimensions}.jpg?api_key=your_key&text=your_prompt`
      });
    }
    
    // Validate API key and get user info
    const keyData = validateApiKey(api_key);
    if (!keyData) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is invalid or inactive'
      });
    }
    
    // Check if user has enough credits
    if (keyData.user.credits < 1) {
      return res.status(402).json({
        error: 'Insufficient credits',
        message: `You need at least 1 credit to generate an image. You have ${keyData.user.credits} credits remaining.`,
        credits_remaining: keyData.user.credits
      });
    }
    
    // Parse dimensions (e.g., "600x400")
    const dimensionMatch = dimensions.match(/^(\d+)x(\d+)$/);
    if (!dimensionMatch) {
      return res.status(400).json({
        error: 'Invalid dimensions format',
        message: 'Use: widthxheight (e.g., 600x400)'
      });
    }

    const width = parseInt(dimensionMatch[1]);
    const height = parseInt(dimensionMatch[2]);

    // Validate dimensions
    if (width < 1 || height < 1 || width > 4096 || height > 4096) {
      return res.status(400).json({
        error: 'Invalid dimensions',
        message: 'Dimensions must be between 1x1 and 4096x4096'
      });
    }

    // Use text prompt or default
    const prompt = text || 'abstract art, colorful, modern design';

    // Create cache key
    const cacheKey = `${width}x${height}_${prompt}`;

    // Check cache first
    let imageBuffer = imageCache.get(cacheKey);
    
    if (!imageBuffer) {
      console.log(`Generating new image for prompt: "${prompt}"`);
      
      try {
        // Generate image using available APIs
        imageBuffer = await generateImage(prompt, width, height);

        // Resize if needed
        if (imageBuffer && imageBuffer.length > 0) {
          imageBuffer = await resizeImage(imageBuffer, width, height);
          
          // Cache the result
          imageCache.set(cacheKey, imageBuffer);
        }
      } catch (error) {
        console.log('Image generation failed, will use fallback SVG');
        throw error;
      }
    } else {
      console.log(`Using cached image for prompt: "${prompt}"`);
    }

    // Deduct credit after successful generation
    try {
      const remainingCredits = deductCredits(keyData.user_id, 1);
      updateApiKeyStats(api_key);
      
      console.log(`✅ Image generated successfully for user ${keyData.user_id}. Credits remaining: ${remainingCredits}`);
    } catch (creditError) {
      console.error('Error deducting credits:', creditError);
      // Don't fail the request if credit deduction fails, but log it
    }

    // Set appropriate headers for better compatibility
    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
      'Content-Length': imageBuffer.length,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, User-Agent',
      'X-Content-Type-Options': 'nosniff'
    });

    res.send(imageBuffer);

  } catch (error) {
    console.error('Error generating image:', error);
    
    // Fallback: Generate a simple placeholder image
    const { dimensions } = req.params;
    const { text } = req.query;
    
    const dimensionMatch = dimensions.match(/^(\d+)x(\d+)$/);
    if (dimensionMatch) {
      const width = parseInt(dimensionMatch[1]);
      const height = parseInt(dimensionMatch[2]);
      
      // Create a simple SVG placeholder
      const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#f0f0f0"/>
          <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="16" 
                text-anchor="middle" dy=".3em" fill="#666">
            ${text || 'AI Image Placeholder'}
          </text>
        </svg>
      `;
      
      res.set({
        'Content-Type': 'image/svg+xml',
        'Access-Control-Allow-Origin': '*'
      });
      res.send(svg);
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
});

// Fallback route handler for image generation (without .jpg extension)
app.get('/:dimensions', async (req, res) => {
  try {
    const { dimensions } = req.params;
    const { text, api_key } = req.query;
    
    // Redirect to .jpg version with API key
    if (api_key) {
      const redirectUrl = `/${dimensions}.jpg?text=${encodeURIComponent(text || '')}&api_key=${api_key}`;
      return res.redirect(redirectUrl);
    }
    
    // If no API key, show error
    return res.status(401).json({
      error: 'API key required',
      message: 'Please provide an API key in the URL: ?api_key=your_api_key',
      example: `/${dimensions}?api_key=your_api_key&text=your_prompt`
    });
    
  } catch (error) {
    console.error('Error in fallback route:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start server only if not in Vercel environment
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 AI Image Placeholder server running on port ${PORT}`);
    console.log(`📝 Example usage: http://localhost:${PORT}/600x400.jpg?api_key=${defaultApiKey}&text=Hello+World`);
    console.log(`🔑 Demo API Key: ${defaultApiKey}`);
    console.log(`🔑 Make sure to set FAL_KEY environment variable`);
  });
}

module.exports = app;