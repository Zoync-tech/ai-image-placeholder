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

// Simple in-memory storage (fallback mode)
const users = new Map();
const apiKeys = new Map();
const sessions = new Map();
const emailVerifications = new Map();

// Initialize with a default user for testing
const defaultUserId = 'user_' + crypto.randomUUID().substring(0, 8);
const defaultApiKey = 'ai_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);

users.set(defaultUserId, {
  id: defaultUserId,
  email: 'demo@example.com',
  name: 'Demo User',
  email_verified: true,
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

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY || 're_2hjEnGgj_FRr1Zi3CBZEDMmv5PXsYuvnZ');

// Generate email verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
}

// Send verification email using Resend
async function sendVerificationEmail(email, code) {
  try {
    console.log(`📧 Sending verification email to ${email} via Resend`);
    
    const { data, error } = await resend.emails.send({
      from: 'AI Image Placeholder <noreply@zoync.com>',
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
      console.error('❌ Resend API Error:', error);
      throw new Error(`Resend API error: ${error.message}`);
    }

    console.log(`✅ Verification email sent successfully to ${email}`);
    console.log(`📧 Resend ID: ${data.id}`);
    return true;

  } catch (error) {
    console.error('❌ Failed to send verification email via Resend:', error.message);
    console.error('❌ Full error details:', error);
    
    // Fallback: Log to console for development
    console.log(`📧 FALLBACK - Verification email for ${email}:`);
    console.log(`🔐 Verification code: ${code}`);
    console.log(`⏰ Code expires in 10 minutes`);
    console.log(`💡 Check RESEND_API_KEY environment variable`);
    console.log(`💡 Current RESEND_API_KEY: ${process.env.RESEND_API_KEY ? 'SET' : 'NOT SET'}`);
    
    return true; // Return true so signup still works
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    mode: 'fallback',
    total_users: users.size,
    total_api_keys: apiKeys.size,
    demo_api_key: defaultApiKey,
    resend_configured: !!process.env.RESEND_API_KEY
  });
});

// Authentication endpoints
app.post('/api/auth/signup', async (req, res) => {
  const { email, name } = req.body;
  
  if (!email || !name) {
    return res.status(400).json({
      error: 'Email and name are required'
    });
  }
  
  try {
    console.log(`📝 Signup attempt for email: ${email}, name: ${name}`);
    
    // Check if user already exists
    const existingUser = Array.from(users.values()).find(user => user.email === email);
    if (existingUser) {
      console.log(`❌ User already exists: ${email}`);
      return res.status(400).json({
        error: 'User with this email already exists'
      });
    }
    
    // Generate verification code
    const verificationCode = generateVerificationCode();
    console.log(`🔐 Generated verification code for ${email}: ${verificationCode}`);
    
    // Store verification code
    emailVerifications.set(email, {
      code: verificationCode,
      name: name,
      created_at: new Date().toISOString()
    });
    console.log(`💾 Stored verification code for ${email}`);
    
    // Send verification email
    const emailSent = await sendVerificationEmail(email, verificationCode);
    console.log(`📧 Email send result for ${email}: ${emailSent}`);
    
    res.json({
      message: 'Please check your email for verification code',
      email: email,
      requires_verification: true
    });
  } catch (error) {
    console.error('❌ Signup error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to process signup',
      details: error.message
    });
  }
});

// Email verification endpoint
app.post('/api/auth/verify-email', async (req, res) => {
  const { email, code } = req.body;
  
  if (!email || !code) {
    return res.status(400).json({
      error: 'Email and verification code are required'
    });
  }
  
  try {
    console.log(`🔍 Verifying email: ${email}, code: ${code}`);
    
    // Get verification data
    const verification = emailVerifications.get(email);
    if (!verification) {
      console.log(`❌ No verification found for ${email}`);
      return res.status(400).json({
        error: 'No verification code found'
      });
    }
    
    // Check if code is expired (10 minutes)
    const now = new Date();
    const expirationTime = new Date(verification.created_at);
    expirationTime.setMinutes(expirationTime.getMinutes() + 10);
    
    if (now > expirationTime) {
      emailVerifications.delete(email);
      console.log(`❌ Verification code expired for ${email}`);
      return res.status(400).json({
        error: 'Verification code expired'
      });
    }
    
    if (verification.code !== code) {
      console.log(`❌ Invalid verification code for ${email}`);
      return res.status(400).json({
        error: 'Invalid verification code'
      });
    }
    
    // Code is valid, create user
    const userId = 'user_' + crypto.randomUUID().substring(0, 8);
    const user = {
      id: userId,
      email: email,
      name: verification.name,
      email_verified: true,
      credits: 5,
      created_at: new Date().toISOString(),
      total_generations: 0
    };
    
    users.set(userId, user);
    console.log(`✅ Created user: ${userId} for email: ${email}`);
    
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
    console.log(`✅ Created API key: ${apiKey} for user: ${userId}`);
    
    // Create session token
    const token = crypto.randomUUID();
    sessions.set(token, {
      user_id: userId,
      created_at: new Date().toISOString()
    });
    
    // Clean up verification
    emailVerifications.delete(email);
    
    res.json({
      token: token,
      user: user,
      api_key: apiKey,
      message: 'Email verified successfully! Account created with 5 free credits.'
    });
  } catch (error) {
    console.error('❌ Email verification error:', error);
    res.status(500).json({
      error: 'Failed to verify email',
      details: error.message
    });
  }
});

// Serve pages
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
  res.sendFile(path.join(__dirname, 'public', 'dashboard-simple.html'));
});

// Start server
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 AI Image Placeholder server running on port ${PORT}`);
    console.log(`📝 Example usage: http://localhost:${PORT}/600x400.jpg?api_key=${defaultApiKey}&text=Hello+World`);
    console.log(`🔑 Make sure to set FAL_KEY and RESEND_API_KEY environment variables`);
  });
}

module.exports = app;
