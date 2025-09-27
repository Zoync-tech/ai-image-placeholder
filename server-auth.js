const express = require('express');
const axios = require('axios');
const sharp = require('sharp');
const NodeCache = require('node-cache');
const cors = require('cors');
const path = require('path');
const { fal } = require('@fal-ai/client');
const { supabase, supabaseClient, SupabaseService } = require('./supabase-config');

const app = express();
const PORT = process.env.PORT || 3000;

// Cache for generated images (24 hour TTL)
const imageCache = new NodeCache({ stdTTL: 86400 });

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
        sync_mode: false // Get URLs instead of data URIs for better performance
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log('FAL AI Status:', update.logs?.map((log) => log.message).join(', '));
        }
      },
    });

    console.log('FAL AI Result:', result.data);
    
    // Download the image from the URL
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve the demo page at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
    res.json(profile);
  } catch (error) {
    console.error('Error getting user profile:', error);
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

    const apiKeys = await SupabaseService.getUserApiKeys(user.id);
    res.json(apiKeys);
  } catch (error) {
    console.error('Error getting API keys:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/user/api-keys', async (req, res) => {
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
    const apiKey = await SupabaseService.generateApiKey(user.id, name);
    res.json(apiKey);
  } catch (error) {
    console.error('Error generating API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/user/history', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const history = await SupabaseService.getUserImageHistory(user.id);
    res.json(history);
  } catch (error) {
    console.error('Error getting user history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Main route handler for image generation (with .jpg extension for VRChat)
app.get('/:dimensions.jpg', async (req, res) => {
  try {
    const { dimensions } = req.params;
    const { text, api_key } = req.query;
    
    // Validate API key
    if (!api_key) {
      return res.status(401).json({
        error: 'API key required',
        message: 'Please provide an API key in the URL: ?api_key=your_api_key'
      });
    }
    
    // Validate API key and get user info
    const apiKeyData = await SupabaseService.validateApiKey(api_key);
    if (!apiKeyData) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is invalid or inactive'
      });
    }
    
    // Check if user has enough credits
    const userCredits = await SupabaseService.checkUserCredits(apiKeyData.user_id);
    if (userCredits < 1) {
      await SupabaseService.logImageGeneration(
        apiKeyData.user_id,
        apiKeyData.id,
        text || 'abstract art',
        dimensions,
        false,
        'Insufficient credits'
      );
      
      return res.status(402).json({
        error: 'Insufficient credits',
        message: 'You need at least 1 credit to generate an image. You have ' + userCredits + ' credits remaining.',
        credits_remaining: userCredits
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

        // Resize if needed (in case API doesn't respect exact dimensions)
        if (imageBuffer && imageBuffer.length > 0) {
          imageBuffer = await resizeImage(imageBuffer, width, height);
          
          // Cache the result
          imageCache.set(cacheKey, imageBuffer);
        }
      } catch (error) {
        console.log('Image generation failed, will use fallback SVG');
        
        // Log failed generation
        await SupabaseService.logImageGeneration(
          apiKeyData.user_id,
          apiKeyData.id,
          prompt,
          dimensions,
          false,
          error.message
        );
        
        throw error; // This will trigger the fallback SVG generation
      }
    } else {
      console.log(`Using cached image for prompt: "${prompt}"`);
    }

    // Deduct credit after successful generation
    try {
      await SupabaseService.deductCredits(apiKeyData.user_id, 1);
      await SupabaseService.logImageGeneration(
        apiKeyData.user_id,
        apiKeyData.id,
        prompt,
        dimensions,
        true
      );
      
      console.log(`✅ Image generated successfully for user ${apiKeyData.user_id}. Credits remaining: ${userCredits - 1}`);
    } catch (creditError) {
      console.error('Error deducting credits:', creditError);
      // Don't fail the request if credit deduction fails, but log it
    }

    // Set appropriate headers for better compatibility
    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
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
    
    // For non-.jpg requests, redirect to .jpg version with API key
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
    console.log(`📝 Example usage: https://vrccim.com/600x400.jpg?api_key=your_key&text=Hello+World`);
    console.log(`🔑 Make sure to set FAL_KEY and Supabase environment variables`);
  });
}

module.exports = app;
