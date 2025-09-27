const express = require('express');
const axios = require('axios');
const sharp = require('sharp');
const NodeCache = require('node-cache');
const cors = require('cors');
const path = require('path');
const { fal } = require('@fal-ai/client');

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    mode: 'minimal'
  });
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

// Main route handler for image generation (with .jpg extension for VRChat)
app.get('/:dimensions.jpg', async (req, res) => {
  try {
    const { dimensions } = req.params;
    const { text } = req.query;
    
    console.log(`Image request: ${dimensions}.jpg, text: "${text}"`);
    
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
    const { text } = req.query;
    
    // Redirect to .jpg version
    const redirectUrl = `/${dimensions}.jpg?text=${encodeURIComponent(text || '')}`;
    return res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('Error in fallback route:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start server only if not in Vercel environment
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 AI Image Placeholder server running on port ${PORT}`);
    console.log(`📝 Example usage: https://vrccim.com/600x400.jpg?text=Hello+World`);
    console.log(`🔑 Make sure to set FAL_KEY environment variable`);
  });
}

module.exports = app;
