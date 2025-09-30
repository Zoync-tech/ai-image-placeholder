# 🚀 Image Cache System Setup Guide

## Problem Solved
**Before**: Multiple users requesting the same image prompt = Multiple expensive API calls to FAL AI
**After**: First user generates image → Cached → All subsequent users get cached result = Only 1 API call!

## How It Works

### 1. Cache Check Flow
```
User requests: "A beautiful sunset" (1024x1024.jpg)
    ↓
🔍 Check database cache
    ↓
✅ Found cached result? → Return cached image (NO API CALL)
❌ Not found? → Generate new image → Cache it → Return image
```

### 2. Cache Key Generation
Each prompt is hashed using:
- Prompt text
- Dimensions (e.g., "1024x1024") 
- Format (e.g., "jpg")
- Additional settings (for future use)

Example: `"A beautiful sunset" + "1024x1024" + "jpg"` = `a1b2c3d4...`

## Setup Steps

### Step 1: Run Database Setup
Execute the cache setup SQL in your Supabase SQL editor:

```sql
-- Copy and paste the entire contents of database-cache-setup.sql
```

### Step 2: Test the Cache System

#### Test 1: First Request (Cache Miss)
```bash
# This will generate a new image and cache it
curl "https://your-site.com/1024x1024.jpg?text=A%20beautiful%20sunset"
```

**Expected logs:**
```
🔍 Checking cache for prompt: "A beautiful sunset" (1024x1024.jpg)
❌ Cache MISS! Need to generate new image for prompt: "A beautiful sunset"
💾 Cached new image for prompt: "A beautiful sunset"
```

#### Test 2: Second Request (Cache Hit)
```bash
# This will return the cached image (NO API CALL!)
curl "https://your-site.com/1024x1024.jpg?text=A%20beautiful%20sunset"
```

**Expected logs:**
```
🔍 Checking cache for prompt: "A beautiful sunset" (1024x1024.jpg)
✅ Cache HIT! Returning cached image for prompt: "A beautiful sunset"
💰 SAVED: No API call needed - cost avoided!
```

## Integration with FAL AI

### Current Implementation (Placeholder)
```javascript
// Current: Returns placeholder image
const generatedUrl = `https://via.placeholder.com/${w}x${h}/6366f1/ffffff?text=${encodeURIComponent(prompt)}`;
```

### FAL AI Integration
Replace the placeholder with actual FAL AI call:

```javascript
// Replace this section in server-with-auth.js
const generatedUrl = `https://via.placeholder.com/${w}x${h}/6366f1/ffffff?text=${encodeURIComponent(prompt)}`;

// With this:
const falResponse = await fal.subscribe("fal-ai/flux/schnell", {
  input: {
    prompt: prompt,
    image_size: "square_hd", // or based on dimensions
    num_inference_steps: 4,
    enable_safety_checker: true
  }
});

const generatedUrl = falResponse.data.images[0].url;
const fileSize = falResponse.data.images[0].file_size; // if available
```

## Cache Management

### View Cache Statistics
```sql
-- See most accessed cached images
SELECT 
  prompt,
  dimensions,
  format,
  access_count,
  created_at,
  last_accessed_at
FROM public.image_cache 
ORDER BY access_count DESC 
LIMIT 10;

-- See cache size
SELECT 
  COUNT(*) as total_cached_images,
  SUM(file_size) as total_size_bytes,
  AVG(access_count) as avg_access_count
FROM public.image_cache;
```

### Cleanup Old Cache Entries
```sql
-- Remove entries older than 30 days
SELECT cleanup_old_cache_entries();
```

## Cost Savings Example

### Before Cache System:
- 5 VRChat users request "A beautiful sunset" = 5 FAL AI API calls
- Cost: 5 × $0.05 = $0.25

### After Cache System:
- 5 VRChat users request "A beautiful sunset" = 1 FAL AI API call
- Cost: 1 × $0.05 = $0.05
- **Savings: 80% reduction in API costs!**

## Monitoring Cache Performance

### Add Cache Stats Endpoint
```javascript
app.get('/api/cache/stats', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('image_cache')
      .select('access_count, file_size, created_at')
      .order('access_count', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    
    const stats = {
      total_cached: data.length,
      total_access_count: data.reduce((sum, item) => sum + item.access_count, 0),
      avg_access_count: data.reduce((sum, item) => sum + item.access_count, 0) / data.length,
      total_size_bytes: data.reduce((sum, item) => sum + (item.file_size || 0), 0)
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
});
```

## Advanced Features

### 1. Cache Warming
Pre-generate popular prompts:
```javascript
const popularPrompts = [
  "A beautiful sunset",
  "A cute cat",
  "A futuristic city",
  "A peaceful forest"
];

for (const prompt of popularPrompts) {
  await SupabaseService.getCachedImage(prompt, "1024x1024", "jpg");
  // This will generate and cache if not exists
}
```

### 2. Cache Invalidation
Remove specific cached entries:
```sql
DELETE FROM public.image_cache 
WHERE prompt_hash = 'specific_hash_here';
```

### 3. Cache Compression
Store compressed versions for bandwidth savings:
```javascript
// Store both original and compressed versions
await SupabaseService.storeCachedImage(
  prompt, dimensions, format, originalUrl, 
  originalSize, generationTime, userId
);

await SupabaseService.storeCachedImage(
  prompt, dimensions, 'webp', compressedUrl, 
  compressedSize, generationTime, userId
);
```

## Troubleshooting

### Cache Not Working?
1. Check if `image_cache` table exists
2. Verify RLS policies are correct
3. Check function permissions in Supabase
4. Look for errors in server logs

### Performance Issues?
1. Add indexes on frequently queried columns
2. Consider cache cleanup schedule
3. Monitor database query performance

## Next Steps

1. ✅ Run `database-cache-setup.sql` in Supabase
2. ✅ Deploy updated server code
3. ✅ Test cache functionality
4. 🔄 Integrate with FAL AI (replace placeholder)
5. 📊 Monitor cache performance and savings
6. 🧹 Set up automated cache cleanup

Your API costs will be dramatically reduced! 🎉
