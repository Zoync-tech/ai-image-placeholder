// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const axios = require('axios');
const sharp = require('sharp');
const NodeCache = require('node-cache');
const cors = require('cors');
const path = require('path');
const { fal } = require('@fal-ai/client');
const crypto = require('crypto');
const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Cache for generated images (24 hour TTL)
const imageCache = new NodeCache({ stdTTL: 86400 });

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseServiceKey;

if (!isSupabaseConfigured) {
  console.warn('⚠️  Supabase environment variables not set. Using in-memory storage (data will be lost on restart).');
  console.warn('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable persistent storage.');
}

// Create Supabase client (with fallback for missing config)
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseServiceKey) : null;

// Fallback in-memory storage (only used if Supabase not configured)
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
    console.log(`🤖 Generating image with FAL AI: "${prompt}"`);
    console.log(`🔧 FAL_KEY configured: ${!!process.env.FAL_KEY}`);
    
    if (!process.env.FAL_KEY) {
      throw new Error('FAL_KEY environment variable is not set');
    }
    
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
          console.log('🤖 FAL AI Status:', update.logs?.map((log) => log.message).join(', '));
        }
      },
    });

    console.log('🤖 FAL AI Result:', result);
    
    if (result.data && result.data.images && result.data.images[0] && result.data.images[0].url) {
      console.log(`📥 Downloading image from URL: ${result.data.images[0].url}`);
      const imageResponse = await axios.get(result.data.images[0].url, {
        responseType: 'arraybuffer',
        timeout: 30000
      });
      
      console.log(`✅ Image downloaded successfully, size: ${imageResponse.data.length} bytes`);
      return Buffer.from(imageResponse.data);
    } else {
      console.error('❌ No image URL returned from FAL AI:', result);
      throw new Error('No image URL returned from FAL AI');
    }
  } catch (error) {
    console.error('❌ FAL AI Error:', error.message);
    console.error('❌ FAL AI Error details:', error);
    throw new Error(`Failed to generate image with FAL AI: ${error.message}`);
  }
}

// Main image generation function
async function generateImage(prompt, width = 600, height = 400) {
  try {
    console.log(`🎨 Generating image with FAL AI Nano Banana: "${prompt}"`);
    const imageBuffer = await generateImageWithFAL(prompt, width, height);
    
    if (imageBuffer && imageBuffer.length > 0) {
      console.log(`✅ Image generated successfully, size: ${imageBuffer.length} bytes`);
      return imageBuffer;
    } else {
      console.log(`❌ Empty image buffer returned`);
      throw new Error('Empty image buffer returned');
    }
  } catch (error) {
    console.error('❌ Image generation failed:', error.message);
    console.error('❌ Full error:', error);
    throw new Error(`Failed to generate image: ${error.message}`);
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
async function validateApiKey(apiKey) {
  const keyData = await SupabaseService.getApiKeyByKey(apiKey);
  if (!keyData || !keyData.is_active) {
    return null;
  }
  
  // Get user by ID instead of email
  const user = await SupabaseService.getUserById(keyData.user_id);
  if (!user) {
    return null;
  }
  
  return { ...keyData, user };
}

// Deduct credits
async function deductCredits(userId, credits = 1) {
  const user = await SupabaseService.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  if (user.credits < credits) {
    throw new Error('Insufficient credits');
  }
  
  const newCredits = user.credits - credits;
  await SupabaseService.updateUserCredits(userId, newCredits);
  
  return newCredits;
}

// Update API key stats
async function updateApiKeyStats(apiKey) {
  await SupabaseService.updateApiKeyUsage(apiKey);
}

// Generate email verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
}

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY || 're_2hjEnGgj_FRr1Zi3CBZEDMmv5PXsYuvnZ');

// Supabase Database Functions
class SupabaseService {
  // User Management
  static async createUser(userData) {
    if (!isSupabaseConfigured) {
      // Fallback to in-memory storage
      const userId = 'user_' + crypto.randomUUID().substring(0, 8);
      const user = { id: userId, ...userData };
      users.set(userId, user);
      console.log(`📝 Created user in in-memory storage: ${userId}`);
      return user;
    }

    try {
      // Generate UUID for user ID if not provided
      if (!userData.id) {
        userData.id = crypto.randomUUID();
      }

      console.log(`📝 Attempting to create user in Supabase:`, userData);

      const { data, error } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single();

      if (error) {
        console.error('Supabase createUser error:', error);
        // Fallback to in-memory storage
        const userId = 'user_' + crypto.randomUUID().substring(0, 8);
        const user = { id: userId, ...userData };
        users.set(userId, user);
        console.log(`📝 Created user in in-memory storage (fallback): ${userId}`);
        return user;
      }

      console.log(`✅ Created user in Supabase:`, data);
      return data;
    } catch (error) {
      console.error('Supabase createUser exception:', error);
      // Fallback to in-memory storage
      const userId = 'user_' + crypto.randomUUID().substring(0, 8);
      const user = { id: userId, ...userData };
      users.set(userId, user);
      console.log(`📝 Created user in in-memory storage (exception fallback): ${userId}`);
      return user;
    }
  }

  static async getUserByEmail(email) {
    if (!isSupabaseConfigured) {
      // Fallback to in-memory storage
      return Array.from(users.values()).find(user => user.email === email) || null;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Supabase getUserByEmail error:', error);
        // Fallback to in-memory storage on Supabase error
        return Array.from(users.values()).find(user => user.email === email) || null;
      }
      return data;
    } catch (error) {
      console.error('Supabase getUserByEmail exception:', error);
      // Fallback to in-memory storage on exception
      return Array.from(users.values()).find(user => user.email === email) || null;
    }
  }

  static async getUserById(userId) {
    if (!isSupabaseConfigured) {
      // Fallback to in-memory storage
      console.log(`📋 Using in-memory storage for getUserById: ${userId}`);
      return users.get(userId) || null;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Supabase getUserById error:', error);
        // Fallback to in-memory storage
        return users.get(userId) || null;
      }
      return data;
    } catch (error) {
      console.error('Supabase getUserById exception:', error);
      // Fallback to in-memory storage
      return users.get(userId) || null;
    }
  }

  static async updateUserCredits(userId, credits) {
    if (!isSupabaseConfigured) {
      // Fallback to in-memory storage
      const user = users.get(userId);
      if (user) {
        user.credits = credits;
        users.set(userId, user);
      }
      return user;
    }

    const { data, error } = await supabase
      .from('users')
      .update({ credits: credits })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateUser(userId, updateData) {
    if (!isSupabaseConfigured) {
      // Fallback to in-memory storage
      const user = users.get(userId);
      if (user) {
        Object.assign(user, updateData);
        user.updated_at = new Date().toISOString();
        users.set(userId, user);
      }
      return user;
    }

    const { data, error } = await supabase
      .from('users')
      .update({ 
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async incrementUserGenerations(userId) {
    if (!isSupabaseConfigured) {
      // Fallback to in-memory storage
      const user = users.get(userId);
      if (user) {
        user.total_generations = (user.total_generations || 0) + 1;
        users.set(userId, user);
      }
      return user;
    }

    try {
      // First get current user data
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('Error fetching user for generation increment:', fetchError);
        return null;
      }

      // Update with incremented total_generations
      const { data, error } = await supabase
        .from('users')
        .update({ 
          total_generations: (currentUser.total_generations || 0) + 1
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Supabase incrementUserGenerations error:', error);
        return null;
      }

      console.log(`✅ Incremented total_generations for user: ${userId}`);
      return data;
    } catch (error) {
      console.error('Supabase incrementUserGenerations exception:', error);
      return null;
    }
  }

  // API Key Management
  static async createApiKey(apiKeyData) {
    if (!isSupabaseConfigured) {
      // Fallback to in-memory storage
      apiKeys.set(apiKeyData.api_key, apiKeyData);
      console.log(`🔑 Created API key in in-memory storage: ${apiKeyData.api_key}`);
      return apiKeyData;
    }

    try {
      const { data, error } = await supabase
        .from('api_keys')
        .insert([apiKeyData])
        .select()
        .single();

      if (error) {
        console.error('Supabase createApiKey error:', error);
        // Fallback to in-memory storage
        apiKeys.set(apiKeyData.api_key, apiKeyData);
        console.log(`🔑 Created API key in in-memory storage (fallback): ${apiKeyData.api_key}`);
        return apiKeyData;
      }

      console.log(`✅ Created API key in Supabase:`, data);
      return data;
    } catch (error) {
      console.error('Supabase createApiKey exception:', error);
      // Fallback to in-memory storage
      apiKeys.set(apiKeyData.api_key, apiKeyData);
      console.log(`🔑 Created API key in in-memory storage (exception fallback): ${apiKeyData.api_key}`);
      return apiKeyData;
    }
  }

  static async getApiKeyByKey(apiKey) {
    if (!isSupabaseConfigured) {
      // Fallback to in-memory storage
      return apiKeys.get(apiKey) || null;
    }

    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async updateApiKeyUsage(apiKey) {
    if (!isSupabaseConfigured) {
      // Fallback to in-memory storage
      const keyData = apiKeys.get(apiKey);
      if (keyData) {
        keyData.total_requests += 1;
        keyData.last_used_at = new Date().toISOString();
        apiKeys.set(apiKey, keyData);
      }
      return keyData;
    }

    try {
      // First get current API key data
      const { data: currentKey, error: fetchError } = await supabase
        .from('api_keys')
        .select('*')
        .eq('api_key', apiKey)
        .single();

      if (fetchError) {
        console.error('Error fetching API key for update:', fetchError);
        return null;
      }

      // Update with incremented total_requests
      const { data, error } = await supabase
        .from('api_keys')
        .update({ 
          total_requests: (currentKey.total_requests || 0) + 1,
          last_used_at: new Date().toISOString()
        })
        .eq('api_key', apiKey)
        .select()
        .single();

      if (error) {
        console.error('Supabase updateApiKeyUsage error:', error);
        return null;
      }

      console.log(`✅ Updated API key stats: ${apiKey}`);
      return data;
    } catch (error) {
      console.error('Supabase updateApiKeyUsage exception:', error);
      return null;
    }
  }

  // Session Management
  static async createSession(sessionData) {
    if (!isSupabaseConfigured) {
      // Fallback to in-memory storage
      sessions.set(sessionData.token, sessionData);
      console.log(`🎫 Created session in in-memory storage: ${sessionData.token}`);
      return sessionData;
    }

    try {
      const { data, error } = await supabase
        .from('sessions')
        .insert([sessionData])
        .select()
        .single();

      if (error) {
        console.error('Supabase createSession error:', error);
        // Fallback to in-memory storage
        sessions.set(sessionData.token, sessionData);
        console.log(`🎫 Created session in in-memory storage (fallback): ${sessionData.token}`);
        return sessionData;
      }

      console.log(`✅ Created session in Supabase:`, data);
      return data;
    } catch (error) {
      console.error('Supabase createSession exception:', error);
      // Fallback to in-memory storage
      sessions.set(sessionData.token, sessionData);
      console.log(`🎫 Created session in in-memory storage (exception fallback): ${sessionData.token}`);
      return sessionData;
    }
  }

  static async getSession(token) {
    if (!isSupabaseConfigured) {
      // Fallback to in-memory storage
      console.log(`📋 Using in-memory storage for getSession: ${token}`);
      const session = sessions.get(token);
      if (session) {
        // Check expiration for in-memory sessions
        const now = new Date();
        const expiresAt = new Date(session.expires_at);
        if (now > expiresAt) {
          console.log(`❌ In-memory session expired for token: ${token}`);
          sessions.delete(token);
          return null;
        }
      }
      return session || null;
    }

    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('token', token)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Supabase getSession error:', error);
        // Fallback to in-memory storage
        const session = sessions.get(token);
        if (session) {
          const now = new Date();
          const expiresAt = new Date(session.expires_at);
          if (now > expiresAt) {
            console.log(`❌ In-memory session expired for token: ${token}`);
            sessions.delete(token);
            return null;
          }
        }
        return session || null;
      }
      
      if (data) {
        // Check if session has expired
        const now = new Date();
        const expiresAt = new Date(data.expires_at);
        if (now > expiresAt) {
          console.log(`❌ Session expired for token: ${token}`);
          // Delete expired session from database
          await supabase.from('sessions').delete().eq('token', token);
          return null;
        }
      }
      
      return data;
    } catch (error) {
      console.error('Supabase getSession exception:', error);
      // Fallback to in-memory storage
      const session = sessions.get(token);
      if (session) {
        const now = new Date();
        const expiresAt = new Date(session.expires_at);
        if (now > expiresAt) {
          console.log(`❌ In-memory session expired for token: ${token}`);
          sessions.delete(token);
          return null;
        }
      }
      return session || null;
    }
  }

  // Email Verification
  static async storeEmailVerification(email, verificationData) {
    if (!isSupabaseConfigured) {
      // Fallback to in-memory storage
      emailVerifications.set(email, verificationData);
      return verificationData;
    }

    try {
      // Delete any existing verification for this email
      await supabase
        .from('email_verifications')
        .delete()
        .eq('email', email);

      const { data, error } = await supabase
        .from('email_verifications')
        .insert([{
          email: email,
          ...verificationData
        }])
        .select()
        .single();

      if (error) {
        console.error('Supabase storeEmailVerification error:', error);
        // Fallback to in-memory storage
        emailVerifications.set(email, verificationData);
        return verificationData;
      }
      return data;
    } catch (error) {
      console.error('Supabase storeEmailVerification exception:', error);
      // Fallback to in-memory storage
      emailVerifications.set(email, verificationData);
      return verificationData;
    }
  }

  static async getEmailVerification(email) {
    if (!isSupabaseConfigured) {
      // Fallback to in-memory storage
      console.log(`📋 Using in-memory storage for email verification: ${email}`);
      return emailVerifications.get(email) || null;
    }

    try {
      const { data, error } = await supabase
        .from('email_verifications')
        .select('*')
        .eq('email', email)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Supabase getEmailVerification error:', error);
        // Fallback to in-memory storage
        return emailVerifications.get(email) || null;
      }
      return data;
    } catch (error) {
      console.error('Supabase getEmailVerification exception:', error);
      // Fallback to in-memory storage
      return emailVerifications.get(email) || null;
    }
  }

  static async deleteEmailVerification(email) {
    if (!isSupabaseConfigured) {
      // Fallback to in-memory storage
      emailVerifications.delete(email);
      console.log(`🗑️ Deleted verification from in-memory storage: ${email}`);
      return true;
    }

    try {
      const { error } = await supabase
        .from('email_verifications')
        .delete()
        .eq('email', email);

      if (error) {
        console.error('Supabase deleteEmailVerification error:', error);
        // Fallback to in-memory storage
        emailVerifications.delete(email);
      }
      console.log(`🗑️ Deleted verification: ${email}`);
      return true;
    } catch (error) {
      console.error('Supabase deleteEmailVerification exception:', error);
      // Fallback to in-memory storage
      emailVerifications.delete(email);
      return true;
    }
  }

  // Image Generation Tracking
  static async saveImageGeneration(generationData) {
    if (!isSupabaseConfigured) {
      // Fallback to in-memory storage
      const id = 'gen_' + crypto.randomUUID().substring(0, 8);
      const generation = { id, ...generationData };
      // Store in a simple array for now (you could use a Map if needed)
      if (!global.imageGenerations) global.imageGenerations = [];
      global.imageGenerations.push(generation);
      console.log(`🖼️ Saved image generation in in-memory storage: ${id}`);
      return generation;
    }

    try {
      const { data, error } = await supabase
        .from('image_generations')
        .insert([generationData])
        .select()
        .single();

      if (error) {
        console.error('Supabase saveImageGeneration error:', error);
        // Fallback to in-memory storage
        const id = 'gen_' + crypto.randomUUID().substring(0, 8);
        const generation = { id, ...generationData };
        if (!global.imageGenerations) global.imageGenerations = [];
        global.imageGenerations.push(generation);
        console.log(`🖼️ Saved image generation in in-memory storage (fallback): ${id}`);
        return generation;
      }

      console.log(`✅ Saved image generation in Supabase:`, data);
      return data;
    } catch (error) {
      console.error('Supabase saveImageGeneration exception:', error);
      // Fallback to in-memory storage
      const id = 'gen_' + crypto.randomUUID().substring(0, 8);
      const generation = { id, ...generationData };
      if (!global.imageGenerations) global.imageGenerations = [];
      global.imageGenerations.push(generation);
      console.log(`🖼️ Saved image generation in in-memory storage (exception fallback): ${id}`);
      return generation;
    }
  }

  static async getUserImageGenerations(userId) {
    if (!isSupabaseConfigured) {
      // Fallback to in-memory storage
      if (!global.imageGenerations) global.imageGenerations = [];
      const userGenerations = global.imageGenerations.filter(gen => gen.user_id === userId);
      console.log(`📊 Retrieved ${userGenerations.length} image generations from in-memory storage`);
      return userGenerations;
    }

    try {
      const { data, error } = await supabase
        .from('image_generations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50); // Limit to last 50 generations

      if (error) {
        console.error('Supabase getUserImageGenerations error:', error);
        // Fallback to in-memory storage
        if (!global.imageGenerations) global.imageGenerations = [];
        const userGenerations = global.imageGenerations.filter(gen => gen.user_id === userId);
        return userGenerations;
      }

      console.log(`📊 Retrieved ${data.length} image generations from Supabase`);
      return data || [];
    } catch (error) {
      console.error('Supabase getUserImageGenerations exception:', error);
      // Fallback to in-memory storage
      if (!global.imageGenerations) global.imageGenerations = [];
      const userGenerations = global.imageGenerations.filter(gen => gen.user_id === userId);
      return userGenerations;
    }
  }

  // Supabase Storage Functions
  static async uploadImageToStorage(imageBuffer, fileName, userId) {
    if (!isSupabaseConfigured) {
      console.log(`📁 Image upload fallback - would save: ${fileName}`);
      return null;
    }

    try {
      // Create a unique file path: images/userId/filename
      const filePath = `images/${userId}/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('generated-images')
        .upload(filePath, imageBuffer, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false // Don't overwrite existing files
        });

      if (error) {
        console.error('Supabase Storage upload error:', error);
        return null;
      }

      console.log(`✅ Image uploaded to Supabase Storage: ${filePath}`);
      return data;
    } catch (error) {
      console.error('Supabase Storage upload exception:', error);
      return null;
    }
  }

  static async getImageFromStorage(filePath) {
    if (!isSupabaseConfigured) {
      console.log(`📁 Image retrieval fallback for: ${filePath}`);
      return null;
    }

    try {
      const { data, error } = await supabase.storage
        .from('generated-images')
        .download(filePath);

      if (error) {
        console.error('Supabase Storage download error:', error);
        return null;
      }

      console.log(`✅ Image retrieved from Supabase Storage: ${filePath}`);
      return data;
    } catch (error) {
      console.error('Supabase Storage download exception:', error);
      return null;
    }
  }

  static async getPublicImageUrl(filePath) {
    if (!isSupabaseConfigured) {
      return null;
    }

    try {
      const { data } = supabase.storage
        .from('generated-images')
        .getPublicUrl(filePath);

      console.log(`🔗 Generated public URL for: ${filePath}`);
      return data.publicUrl;
    } catch (error) {
      console.error('Supabase Storage public URL exception:', error);
      return null;
    }
  }

  static async updateImageGenerationWithStorage(generationId, storagePath, publicUrl) {
    if (!isSupabaseConfigured) {
      console.log(`📁 Would update generation ${generationId} with storage path: ${storagePath}`);
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('image_generations')
        .update({
          storage_path: storagePath,
          public_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', generationId)
        .select()
        .single();

      if (error) {
        console.error('Supabase updateImageGenerationWithStorage error:', error);
        return null;
      }

      console.log(`✅ Updated image generation with storage info: ${generationId}`);
      return data;
    } catch (error) {
      console.error('Supabase updateImageGenerationWithStorage exception:', error);
      return null;
    }
  }
}

// Send verification email using Resend
async function sendVerificationEmail(email, code) {
  try {
    console.log(`📧 Sending verification email to ${email} via Resend`);
    
    const { data, error } = await resend.emails.send({
      from: 'VRC Cloud Instance Manager <noreply@zoync.com>',
      to: [email],
      subject: 'Verify Your Email - VRC Cloud Instance Manager',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 32px; font-weight: 300;">☁️ VRC Cloud Instance Manager</h1>
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

// Send password reset email using Resend
async function sendPasswordResetEmail(email, code) {
  try {
    console.log(`📧 Sending password reset email to ${email} via Resend`);
    
    const { data, error } = await resend.emails.send({
      from: 'VRC Cloud Instance Manager <noreply@zoync.com>',
      to: [email],
      subject: 'Reset Your Password - VRC Cloud Instance Manager',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 32px; font-weight: 300;">☁️ VRC Cloud Instance Manager</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Password Reset</p>
          </div>
          
          <div style="background: white; padding: 40px; border: 1px solid #e1e5e9; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-bottom: 20px; font-size: 24px;">Reset Your Password</h2>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px; font-size: 16px;">
              You requested to reset your password. Use the code below to reset your password:
            </p>
            
            <div style="background: #f8f9fa; border: 3px solid #667eea; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
              <div style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 4px; font-family: 'Courier New', monospace; margin-bottom: 10px;">
                ${code}
              </div>
              <p style="margin: 0; color: #666; font-size: 14px;">Enter this code to reset your password</p>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>⏰ Important:</strong> This code will expire in 10 minutes for security reasons.
              </p>
            </div>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 25px; font-size: 16px;">
              If you didn't request this password reset, please ignore this email.
            </p>
            
            <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid #e1e5e9;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                This is an automated message from VRC Cloud Instance Manager.
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
        VRC Cloud Instance Manager - Password Reset
        
        Your password reset code is: ${code}
        
        Enter this code to reset your password.
        
        This code expires in 10 minutes.
        
        If you didn't request this password reset, please ignore this email.
      `
    });

    if (error) {
      console.error('❌ Failed to send password reset email via Resend:', error.message);
      return false;
    }

    console.log(`✅ Password reset email sent successfully to ${email}`);
    console.log(`📧 Resend ID: ${data.id}`);
    return true;
  } catch (error) {
    console.error('❌ Password reset email error:', error);
    return false;
  }
}

// Verify email code
async function verifyEmailCode(email, code) {
  try {
    console.log(`🔍 Verifying email: ${email}, code: ${code}`);
    
    const verification = await SupabaseService.getEmailVerification(email);
    console.log(`📋 Retrieved verification data:`, verification ? 'Found' : 'Not found');
    
    if (!verification) {
      console.log(`❌ No verification code found for ${email}`);
      return { success: false, error: 'No verification code found' };
    }
    
    // Check if code is expired (10 minutes)
    const now = new Date();
    const expirationTime = new Date(verification.created_at);
    expirationTime.setMinutes(expirationTime.getMinutes() + 10);
    
    console.log(`⏰ Checking expiration: now=${now.toISOString()}, expires=${expirationTime.toISOString()}`);
    
    if (now > expirationTime) {
      console.log(`❌ Verification code expired for ${email}`);
      await SupabaseService.deleteEmailVerification(email);
      return { success: false, error: 'Verification code expired' };
    }
    
    console.log(`🔐 Comparing codes: stored="${verification.code}", provided="${code}"`);
    
    if (verification.code !== code) {
      console.log(`❌ Invalid verification code for ${email}`);
      return { success: false, error: 'Invalid verification code' };
    }
    
    console.log(`✅ Verification code is valid for ${email}`);
    
    // Code is valid, delete verification record
    await SupabaseService.deleteEmailVerification(email);
    return { success: true, name: verification.name };
  } catch (error) {
    console.error('❌ verifyEmailCode error:', error);
    return { success: false, error: 'Verification failed: ' + error.message };
  }
}

// Favicon handler
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No Content
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    mode: 'with-auth',
    total_users: users.size,
    total_api_keys: apiKeys.size,
    demo_api_key: defaultApiKey,
    resend_configured: !!process.env.RESEND_API_KEY,
    supabase_configured: isSupabaseConfigured,
    supabase_url: process.env.SUPABASE_URL ? 'SET' : 'NOT SET',
    supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET'
  });
});

// Test endpoint for debugging
app.post('/api/test-verification', (req, res) => {
  console.log('🧪 Test endpoint hit');
  console.log('📥 Request body:', req.body);
  console.log('📥 Request headers:', req.headers);
  res.json({
    message: 'Test endpoint working',
    body: req.body,
    headers: req.headers
  });
});

// Supabase status endpoint
app.get('/api/supabase-status', async (req, res) => {
  try {
    const status = {
      configured: isSupabaseConfigured,
      url: process.env.SUPABASE_URL ? 'SET' : 'NOT SET',
      service_key: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET',
      url_value: process.env.SUPABASE_URL || 'NOT SET',
      service_key_preview: process.env.SUPABASE_SERVICE_ROLE_KEY ? 
        process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + '...' : 'NOT SET',
      timestamp: new Date().toISOString(),
      in_memory_users: Array.from(users.values()),
      in_memory_sessions: Array.from(sessions.entries()),
      in_memory_api_keys: Array.from(apiKeys.entries())
    };

    if (isSupabaseConfigured) {
      // Test Supabase connection
      try {
        const { data, error } = await supabase
          .from('users')
          .select('count')
          .limit(1);
        
        if (error) {
          status.connection = 'FAILED';
          status.error = error.message;
        } else {
          status.connection = 'SUCCESS';
        }
      } catch (error) {
        status.connection = 'FAILED';
        status.error = error.message;
      }
    } else {
      status.connection = 'NOT_CONFIGURED';
      status.reason = 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables';
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check Supabase status',
      details: error.message
    });
  }
});

// Debug verification endpoint
app.post('/api/debug-verification', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    console.log(`🔍 Debug verification for email: ${email}`);
    
    const verification = await SupabaseService.getEmailVerification(email);
    
    res.json({
      email: email,
      verification: verification,
      in_memory_verifications: Array.from(emailVerifications.entries()),
      supabase_configured: isSupabaseConfigured,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Debug verification error:', error);
    res.status(500).json({ 
      error: 'Debug failed',
      details: error.message 
    });
  }
});

// Simple endpoint to list all pending verifications
app.get('/api/debug-verifications', (req, res) => {
  try {
    const inMemoryVerifications = Array.from(emailVerifications.entries());
    
    res.json({
      in_memory_verifications: inMemoryVerifications,
      supabase_configured: isSupabaseConfigured,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Debug verifications error:', error);
    res.status(500).json({ 
      error: 'Debug failed',
      details: error.message 
    });
  }
});

// Test verification flow endpoint
app.post('/api/test-verification-flow', async (req, res) => {
  const { email, name } = req.body;
  
  if (!email || !name) {
    return res.status(400).json({ error: 'Email and name are required' });
  }

  try {
    console.log(`🧪 Testing verification flow for email: ${email}`);
    
    // Generate verification code
    const verificationCode = generateVerificationCode();
    console.log(`🔐 Generated test verification code: ${verificationCode}`);
    
    // Store verification code
    const verificationData = {
      code: verificationCode,
      name: name,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
      created_at: new Date().toISOString()
    };
    
    await SupabaseService.storeEmailVerification(email, verificationData);
    console.log(`💾 Stored test verification code`);
    
    // Immediately try to retrieve it
    const storedVerification = await SupabaseService.getEmailVerification(email);
    console.log(`🔍 Retrieved test verification:`, storedVerification);
    
    // Try to verify it
    const verificationResult = await verifyEmailCode(email, verificationCode);
    console.log(`✅ Test verification result:`, verificationResult);
    
    res.json({
      email: email,
      generated_code: verificationCode,
      stored_verification: storedVerification,
      verification_result: verificationResult,
      in_memory_verifications: Array.from(emailVerifications.entries()),
      supabase_configured: isSupabaseConfigured,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Test verification flow error:', error);
    res.status(500).json({ 
      error: 'Test failed',
      details: error.message 
    });
  }
});

// Test email endpoint
app.post('/api/test-email', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    console.log(`🧪 Testing email to ${email}`);
    
    const { data, error } = await resend.emails.send({
      from: 'VRC Cloud Instance Manager <noreply@zoync.com>',
      to: [email],
      subject: 'Test Email - AI Image Placeholder',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>🎨 AI Image Placeholder</h1>
          <p>This is a test email to verify your email configuration is working correctly.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p>If you receive this email, your Resend configuration is working!</p>
        </div>
      `,
      text: `AI Image Placeholder - Test Email\n\nThis is a test email to verify your email configuration is working correctly.\n\nTimestamp: ${new Date().toISOString()}\n\nIf you receive this email, your Resend configuration is working!`
    });

    if (error) {
      console.error('❌ Test email error:', error);
      return res.status(500).json({ 
        error: 'Failed to send test email',
        details: error.message 
      });
    }

    console.log(`✅ Test email sent successfully to ${email}`);
    res.json({ 
      success: true, 
      messageId: data.id,
      message: 'Test email sent successfully'
    });

  } catch (error) {
    console.error('❌ Test email exception:', error);
    res.status(500).json({ 
      error: 'Failed to send test email',
      details: error.message 
    });
  }
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
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
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
    const existingUser = await SupabaseService.getUserByEmail(email);
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
    const verificationData = {
      code: verificationCode,
      name: name,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
      created_at: new Date().toISOString()
    };
    
    await SupabaseService.storeEmailVerification(email, verificationData);
    console.log(`💾 Stored verification code for ${email}`);
    
    // Immediately verify it was stored correctly
    const storedVerification = await SupabaseService.getEmailVerification(email);
    console.log(`✅ Verification storage check for ${email}:`, storedVerification ? 'SUCCESS' : 'FAILED');
    if (storedVerification) {
      console.log(`📋 Stored code: ${storedVerification.code}, Expected: ${verificationCode}`);
    }
    
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
  console.log('🔍 Verification endpoint hit');
  console.log('📥 Request body:', req.body);
  console.log('📥 Request headers:', req.headers);
  
  const { email, code } = req.body;
  
  console.log('📧 Email:', email);
  console.log('🔐 Code:', code);
  
  if (!email || !code) {
    console.log('❌ Missing email or code');
    console.log('📧 Email present:', !!email);
    console.log('🔐 Code present:', !!code);
    return res.status(400).json({
      error: 'Email and verification code are required'
    });
  }
  
  try {
    console.log(`🔍 Email verification attempt: ${email}, code: ${code}`);
    
    // Verify the code
    const verification = await verifyEmailCode(email, code);
    console.log(`🔐 Verification result:`, verification);
    
    if (!verification.success) {
      console.log(`❌ Verification failed: ${verification.error}`);
      return res.status(400).json({
        error: verification.error
      });
    }
    
    console.log(`✅ Email verification successful for ${email}`);
    
    // Create new user
    const userData = {
      email: email,
      name: verification.name,
      email_verified: true,
      credits: 5, // 5 free credits
      created_at: new Date().toISOString(),
      total_generations: 0
    };
    
    console.log(`👤 Creating user with data:`, userData);
    const user = await SupabaseService.createUser(userData);
    console.log(`✅ User created:`, user);
    
    // Create default API key
    const apiKey = 'ai_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    const apiKeyData = {
      api_key: apiKey,
      user_id: user.id,
      name: 'Default API Key',
      is_active: true,
      created_at: new Date().toISOString(),
      total_requests: 0,
      last_used_at: null
    };
    
    console.log(`🔑 Creating API key:`, apiKeyData);
    await SupabaseService.createApiKey(apiKeyData);
    console.log(`✅ API key created: ${apiKey}`);
    
    // Create session token
    const token = crypto.randomUUID();
    const sessionData = {
      token: token,
      user_id: user.id,
      created_at: new Date().toISOString()
    };
    
    console.log(`🎫 Creating session:`, sessionData);
    await SupabaseService.createSession(sessionData);
    console.log(`✅ Session created: ${token}`);
    
    res.json({
      token: token,
      user: user,
      api_key: apiKey,
      message: 'Email verified successfully! Account created with 5 free credits.'
    });
  } catch (error) {
    console.error('❌ Email verification error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to verify email',
      details: error.message
    });
  }
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
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
    created_at: new Date().toISOString()
  });
  
  // Send verification email
  sendVerificationEmail(email, verificationCode);
  
  res.json({
    message: 'New verification code sent to your email'
  });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        error: 'Email is required'
      });
    }
    
    console.log(`🔐 Login attempt for email: ${email}`);
    
    // Find user by email using SupabaseService
    const user = await SupabaseService.getUserByEmail(email);
    if (!user) {
      console.log(`❌ User not found for email: ${email}`);
      return res.status(401).json({
        error: 'User not found. Please sign up first.'
      });
    }
    
    console.log(`✅ Found user:`, user);
    
    // Check if email is verified
    if (!user.email_verified) {
      console.log(`❌ Email not verified for user: ${user.id}`);
      return res.status(403).json({
        error: 'Email not verified. Please verify your email first.',
        requires_verification: true
      });
    }
    
    // Create session using SupabaseService
    const token = 'session_' + crypto.randomUUID();
    const sessionData = {
      token,
      user_id: user.id,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    };
    
    const createdSession = await SupabaseService.createSession(sessionData);
    if (!createdSession) {
      console.log(`❌ Failed to create session for user: ${user.id}`);
      return res.status(500).json({
        error: 'Failed to create session'
      });
    }
    
    console.log(`✅ Created session:`, createdSession.token);
    
    res.json({
      token: createdSession.token,
      user: user,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      details: error.message
    });
  }
});

// Forgot password endpoint
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        error: 'Email is required'
      });
    }
    
    console.log(`🔍 Forgot password request for email: ${email}`);
    
    // Check if user exists
    const user = await SupabaseService.getUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }
    
    // Generate password reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetData = {
      email: email,
      code: resetCode,
      name: user.name || 'User', // Include name to avoid null constraint error
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
    };
    
    // Store reset code
    await SupabaseService.storeEmailVerification(email, resetData);
    
    // Send password reset email
    const emailSent = await sendPasswordResetEmail(email, resetCode);
    
    if (emailSent) {
      console.log(`✅ Password reset email sent to ${email}`);
      res.json({
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    } else {
      console.log(`❌ Failed to send password reset email to ${email}`);
      res.status(500).json({
        error: 'Failed to send password reset email'
      });
    }
  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({
      error: 'Failed to process password reset request',
      details: error.message
    });
  }
});

// Reset password endpoint
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    
    if (!email || !code || !newPassword) {
      return res.status(400).json({
        error: 'Email, code, and new password are required'
      });
    }
    
    console.log(`🔍 Password reset attempt for email: ${email}`);
    
    // Verify the reset code
    const verification = await SupabaseService.getEmailVerification(email);
    if (!verification) {
      console.log(`❌ No reset code found for ${email}`);
      return res.status(400).json({
        error: 'Invalid or expired reset code'
      });
    }
    
    // Check if code matches
    if (verification.code !== code) {
      console.log(`❌ Invalid reset code for ${email}`);
      return res.status(400).json({
        error: 'Invalid reset code'
      });
    }
    
    // Check if code is expired
    const now = new Date();
    const expiresAt = new Date(verification.expires_at);
    if (now > expiresAt) {
      console.log(`❌ Reset code expired for ${email}`);
      await SupabaseService.deleteEmailVerification(email);
      return res.status(400).json({
        error: 'Reset code has expired. Please request a new one.'
      });
    }
    
    // Find user
    const user = await SupabaseService.getUserByEmail(email);
    if (!user) {
      console.log(`❌ User not found for ${email}`);
      return res.status(404).json({
        error: 'User not found'
      });
    }
    
    // Update user password (hash it in a real implementation)
    const updatedUser = await SupabaseService.updateUser(user.id, { 
      password: newPassword // In production, hash this password
    });
    
    if (!updatedUser) {
      console.log(`❌ Failed to update password for ${email}`);
      return res.status(500).json({
        error: 'Failed to update password'
      });
    }
    
    // Delete the reset code
    await SupabaseService.deleteEmailVerification(email);
    
    console.log(`✅ Password reset successful for ${email}`);
    res.json({
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({
      error: 'Failed to reset password',
      details: error.message
    });
  }
});

// Middleware to validate session token
async function validateSession(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  console.log(`🔍 Session validation - Token: ${token ? 'provided' : 'missing'}`);
  console.log(`🔍 Session validation - Headers:`, req.headers.authorization ? 'Authorization header present' : 'No Authorization header');

  if (!token) {
    console.log(`❌ No token provided in validateSession`);
    return res.status(401).json({
      error: 'No token provided'
    });
  }

  try {
    console.log(`🔍 Looking up session for token: ${token}`);
    const session = await SupabaseService.getSession(token);
    console.log(`🔍 Session lookup result:`, session ? `Found session for user ${session.user_id}` : 'No session found');
    
    if (!session) {
      console.log(`❌ Invalid or expired token: ${token}`);
      return res.status(401).json({
        error: 'Invalid or expired token'
      });
    }

    req.userId = session.user_id;
    console.log(`✅ Session validated for user: ${req.userId}`);
    next();
  } catch (error) {
    console.error('❌ Session validation error:', error);
    return res.status(401).json({
      error: 'Session validation failed'
    });
  }
}

// User profile endpoint
app.get('/api/user/profile', validateSession, async (req, res) => {
  try {
    console.log(`👤 Getting profile for user: ${req.userId}`);
    
    const user = await SupabaseService.getUserById(req.userId);
    if (!user) {
      console.log(`❌ User not found: ${req.userId}`);
      return res.status(404).json({
        error: 'User not found'
      });
    }

    console.log(`✅ Found user profile:`, user);
    res.json(user);
  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({
      error: 'Failed to get user profile',
      details: error.message
    });
  }
});

// Update user profile endpoint
app.put('/api/user/profile', validateSession, async (req, res) => {
  try {
    console.log(`👤 Updating profile for user: ${req.userId}`);
    
    const { name } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        error: 'Name is required'
      });
    }

    const user = await SupabaseService.getUserById(req.userId);
    if (!user) {
      console.log(`❌ User not found: ${req.userId}`);
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Update user in Supabase
    const updatedUser = await SupabaseService.updateUser(req.userId, { name: name.trim() });
    
    if (!updatedUser) {
      console.log(`❌ Failed to update user: ${req.userId}`);
      return res.status(500).json({
        error: 'Failed to update profile'
      });
    }

    console.log(`✅ Updated user profile:`, updatedUser);
    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      details: error.message
    });
  }
});

// User API keys endpoint
app.get('/api/user/api-keys', validateSession, async (req, res) => {
  try {
    console.log(`🔑 Getting API keys for user: ${req.userId}`);
    
    if (!isSupabaseConfigured) {
      // Fallback to in-memory storage
      const userApiKeys = Array.from(apiKeys.entries())
        .filter(([key, value]) => value.user_id === req.userId)
        .map(([key, value]) => ({
          id: key,
          api_key: key,
          name: value.name,
          is_active: value.is_active,
          created_at: value.created_at,
          total_requests: value.total_requests,
          last_used_at: value.last_used_at
        }));
      
      return res.json({ api_keys: userApiKeys });
    }

    // Get API keys from Supabase
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching API keys:', error);
      // Fallback to in-memory storage
      const userApiKeys = Array.from(apiKeys.entries())
        .filter(([key, value]) => value.user_id === req.userId)
        .map(([key, value]) => ({
          id: key,
          api_key: key,
          name: value.name,
          is_active: value.is_active,
          created_at: value.created_at,
          total_requests: value.total_requests,
          last_used_at: value.last_used_at
        }));
      
      return res.json({ api_keys: userApiKeys });
    }

    console.log(`✅ Found ${data.length} API keys for user`);
    res.json({ api_keys: data });
  } catch (error) {
    console.error('❌ Get API keys error:', error);
    res.status(500).json({
      error: 'Failed to get API keys',
      details: error.message
    });
  }
});

// User image generations endpoint
app.get('/api/user/image-generations', validateSession, async (req, res) => {
  try {
    console.log(`🖼️ Getting image generations for user: ${req.userId}`);
    
    const generations = await SupabaseService.getUserImageGenerations(req.userId);
    
    console.log(`✅ Found ${generations.length} image generations for user`);
    res.json({ generations: generations });
  } catch (error) {
    console.error('❌ Get image generations error:', error);
    res.status(500).json({
      error: 'Failed to get image generations',
      details: error.message
    });
  }
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
app.post('/api/create-key', validateSession, async (req, res) => {
  try {
    const { name = 'My API Key' } = req.body;
    const userId = req.userId;
    
    console.log(`🔑 Creating API key for user: ${userId}`);
    
    // Check if user already has an API key
    if (!isSupabaseConfigured) {
      // Check in-memory storage
      const existingKeys = Array.from(apiKeys.entries())
        .filter(([key, value]) => value.user_id === userId);
      
      if (existingKeys.length > 0) {
        return res.status(400).json({
          error: 'You already have an API key',
          message: 'Each user can only have one API key'
        });
      }
    } else {
      // Check Supabase
      const { data: existingKeys, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', userId);
      
      if (error) {
        console.error('❌ Error checking existing API keys:', error);
      } else if (existingKeys && existingKeys.length > 0) {
        return res.status(400).json({
          error: 'You already have an API key',
          message: 'Each user can only have one API key',
          existing_api_key: existingKeys[0].api_key
        });
      }
    }
    
    const apiKey = 'ai_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    const apiKeyData = {
      api_key: apiKey,
      user_id: userId,
      name: name,
      is_active: true,
      created_at: new Date().toISOString(),
      total_requests: 0,
      last_used_at: null
    };
    
    console.log(`🔑 API key data:`, apiKeyData);
    
    // Create API key using SupabaseService
    const createdApiKey = await SupabaseService.createApiKey(apiKeyData);
    if (!createdApiKey) {
      console.log(`❌ Failed to create API key for user: ${userId}`);
      return res.status(500).json({
        error: 'Failed to create API key'
      });
    }
    
    console.log(`✅ Created API key:`, createdApiKey);
    
    // Get user data to return credits
    const user = await SupabaseService.getUserById(userId);
    if (!user) {
      console.log(`❌ User not found: ${userId}`);
      return res.status(404).json({
        error: 'User not found'
      });
    }
    
    res.json({
      api_key: createdApiKey.api_key,
      user_id: userId,
      name: createdApiKey.name,
      credits: user.credits,
      message: 'API key created successfully!'
    });
  } catch (error) {
    console.error('❌ Create API key error:', error);
    res.status(500).json({
      error: 'Failed to create API key',
      details: error.message
    });
  }
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

// Specific routes for HTML pages (must come before catch-all routes)
app.get('/ai-image-generator.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ai-image-generator.html'));
});

app.get('/api-keys.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'api-keys.html'));
});

app.get('/settings.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/auth.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

app.get('/verify.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verify.html'));
});

app.get('/reset-password.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

// Main route handler for image generation (with .jpg extension for VRChat)
app.get('/:dimensions.jpg', async (req, res) => {
  try {
    const { dimensions } = req.params;
    const { text, api_key } = req.query;
    
    console.log(`🎨 Image request: ${dimensions}.jpg, text: "${text}", api_key: ${api_key ? 'provided' : 'missing'}`);
    console.log(`🔧 FAL_KEY configured: ${!!process.env.FAL_KEY}`);
    
    // Validate API key
    if (!api_key) {
      console.log(`❌ No API key provided`);
      return res.status(401).json({
        error: 'API key required',
        message: 'Please provide an API key in the URL: ?api_key=your_api_key',
        example: `/${dimensions}.jpg?api_key=your_key&text=your_prompt`
      });
    }
    
    // Validate API key and get user info
    console.log(`🔑 Validating API key: ${api_key}`);
    const keyData = await validateApiKey(api_key);
    if (!keyData) {
      console.log(`❌ Invalid API key: ${api_key}`);
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is invalid or inactive'
      });
    }
    
    console.log(`✅ API key valid for user: ${keyData.user.email}`);
    console.log(`💳 User credits: ${keyData.user.credits}`);
    
    // Check if user has enough credits
    if (keyData.user.credits < 1) {
      console.log(`❌ Insufficient credits: ${keyData.user.credits}`);
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
    
    console.log(`🎨 Generating image with prompt: "${prompt}"`);
    console.log(`📐 Dimensions: ${width}x${height}`);

    // Create cache key
    const cacheKey = `${width}x${height}_${prompt}`;

    // Check cache first
    let imageBuffer = imageCache.get(cacheKey);
    
    if (!imageBuffer) {
      console.log(`🔄 Cache miss - generating new image for prompt: "${prompt}"`);
      
      try {
        console.log(`🤖 Calling generateImage function...`);
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

    // Save image generation record
    let generationRecord = null;
    try {
      generationRecord = await SupabaseService.saveImageGeneration({
        user_id: keyData.user_id,
        api_key_id: keyData.id,
        prompt: prompt,
        dimensions: dimensions,
        success: true,
        created_at: new Date().toISOString()
      });
      console.log(`✅ Saved image generation record for user ${keyData.user_id}`);
    } catch (saveError) {
      console.error('Error saving image generation:', saveError);
    }

    // Upload image to Supabase Storage
    if (generationRecord && generationRecord.id) {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${dimensions}_${timestamp}.jpg`;
        const storageResult = await SupabaseService.uploadImageToStorage(imageBuffer, fileName, keyData.user_id);
        
        if (storageResult) {
          const publicUrl = await SupabaseService.getPublicImageUrl(storageResult.path);
          await SupabaseService.updateImageGenerationWithStorage(generationRecord.id, storageResult.path, publicUrl);
          console.log(`✅ Image uploaded to Supabase Storage: ${storageResult.path}`);
        }
      } catch (storageError) {
        console.error('Error uploading image to storage:', storageError);
        // Don't fail the request if storage upload fails
      }
    }

    // Deduct credit after successful generation
    try {
      const remainingCredits = await deductCredits(keyData.user_id, 1);
      await updateApiKeyStats(api_key);
      await SupabaseService.incrementUserGenerations(keyData.user_id);
      
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
    console.error('❌ Error generating image:', error);
    console.error('❌ Full error details:', error);
    
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

// Debug login endpoint
app.post('/api/debug-login', async (req, res) => {
  const { email } = req.body;
  
  try {
    console.log(`🔍 Debug login for email: ${email}`);
    
    // Check Supabase status
    const supabaseStatus = {
      configured: isSupabaseConfigured,
      url: process.env.SUPABASE_URL ? 'SET' : 'NOT SET'
    };
    
    // Try to find user in Supabase
    let supabaseUser = null;
    if (isSupabaseConfigured) {
      try {
        supabaseUser = await SupabaseService.getUserByEmail(email);
        console.log(`📊 Supabase user:`, supabaseUser);
      } catch (error) {
        console.error('❌ Supabase user lookup error:', error);
      }
    }
    
    // Check in-memory storage
    const inMemoryUser = Array.from(users.values()).find(u => u.email === email);
    console.log(`📊 In-memory user:`, inMemoryUser);
    
    // Check all users in memory
    const allInMemoryUsers = Array.from(users.values());
    console.log(`📊 All in-memory users:`, allInMemoryUsers);
    
    res.json({
      email: email,
      supabase_status: supabaseStatus,
      supabase_user: supabaseUser,
      in_memory_user: inMemoryUser,
      all_in_memory_users: allInMemoryUsers,
      total_in_memory_users: allInMemoryUsers.length
    });
    
  } catch (error) {
    console.error('❌ Debug login error:', error);
    res.status(500).json({
      error: 'Debug failed',
      details: error.message
    });
  }
});

// Debug API key creation endpoint
app.post('/api/debug-create-key', validateSession, async (req, res) => {
  try {
    const { name = 'Debug API Key' } = req.body;
    const userId = req.userId;
    
    console.log(`🔍 Debug API key creation for user: ${userId}`);
    
    // Check user exists
    const user = await SupabaseService.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        userId: userId
      });
    }
    
    // Check Supabase status
    const supabaseStatus = {
      configured: isSupabaseConfigured,
      url: process.env.SUPABASE_URL ? 'SET' : 'NOT SET'
    };
    
    // Check existing API keys
    let existingApiKeys = [];
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('api_keys')
          .select('*')
          .eq('user_id', userId);
        
        if (error) {
          console.error('❌ Error fetching existing API keys:', error);
        } else {
          existingApiKeys = data || [];
        }
      } catch (error) {
        console.error('❌ Exception fetching existing API keys:', error);
      }
    }
    
    // Check in-memory API keys
    const inMemoryApiKeys = Array.from(apiKeys.entries()).filter(([key, value]) => value.user_id === userId);
    
    res.json({
      userId: userId,
      user: user,
      supabase_status: supabaseStatus,
      existing_api_keys: existingApiKeys,
      in_memory_api_keys: inMemoryApiKeys,
      total_existing_keys: existingApiKeys.length,
      total_in_memory_keys: inMemoryApiKeys.length
    });
    
  } catch (error) {
    console.error('❌ Debug create key error:', error);
    res.status(500).json({
      error: 'Debug failed',
      details: error.message
    });
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