# 🎮 VRChat Request Queuing System

## Problem Solved
**Before**: 5 VRChat users load the same link simultaneously → 5 expensive FAL AI API calls
**After**: 5 VRChat users load the same link simultaneously → 1 FAL AI API call + 4 users wait for the same result

## How It Works

### 🚀 Request Flow
```
User 1: "A beautiful sunset" → Creates generation status → Starts generation
User 2: "A beautiful sunset" → Finds existing generation → Waits for completion
User 3: "A beautiful sunset" → Finds existing generation → Waits for completion
User 4: "A beautiful sunset" → Finds existing generation → Waits for completion
User 5: "A beautiful sunset" → Finds existing generation → Waits for completion

Result: Only 1 API call made, all 5 users get the same image!
```

### 📊 Generation Statuses
- **`pending`**: First request, about to start generation
- **`generating`**: Currently making API call to FAL AI
- **`completed`**: Generation finished, image ready
- **`failed`**: Generation failed, error occurred

### ⏱️ Timing
- **Cache Hit**: Instant response (< 100ms)
- **Generation Complete**: Instant response (< 100ms)
- **Generation In Progress**: Wait up to 30 seconds (polling every 1 second)
- **New Generation**: Wait for generation time + polling

## Database Schema

### `generation_status` Table
```sql
- id: UUID (primary key)
- prompt_hash: SHA256 hash of prompt + dimensions + format
- prompt: Original prompt text
- dimensions: "1024x1024"
- format: "jpg", "png", etc.
- status: "pending", "generating", "completed", "failed"
- generated_url: URL of generated image
- error_message: Error if generation failed
- total_requests: How many users requested this prompt
- api_calls_made: How many actual API calls were made
- created_at, started_at, completed_at: Timestamps
```

## Setup Steps

### Step 1: Run Database Setup
Execute both SQL files in Supabase:

1. **`database-cache-setup.sql`** - For image caching
2. **`database-generation-queue.sql`** - For request queuing

### Step 2: Deploy Updated Server
The server now includes:
- ✅ Cache checking (instant response for existing images)
- ✅ Generation status tracking
- ✅ Request queuing system
- ✅ Polling for completion
- ✅ Automatic caching of completed generations

### Step 3: Test the System

#### Test Scenario: Multiple Simultaneous Requests
```bash
# Terminal 1: First request (will start generation)
curl "https://your-site.com/1024x1024.jpg?text=A%20beautiful%20sunset"

# Terminal 2: Second request (will wait for first to complete)
curl "https://your-site.com/1024x1024.jpg?text=A%20beautiful%20sunset"

# Terminal 3: Third request (will wait for first to complete)
curl "https://your-site.com/1024x1024.jpg?text=A%20beautiful%20sunset"
```

**Expected Behavior:**
- Request 1: Starts generation, returns image after 2-5 seconds
- Request 2: Waits for Request 1, returns same image
- Request 3: Waits for Request 1, returns same image
- **Only 1 API call made total!**

## Integration with FAL AI

### Current Implementation (Placeholder)
```javascript
// Simulates 2-second generation time
await new Promise(resolve => setTimeout(resolve, 2000));
const generatedUrl = `https://via.placeholder.com/${dimensions}/6366f1/ffffff?text=${encodeURIComponent(prompt)}`;
```

### FAL AI Integration
Replace the placeholder with actual FAL AI call:

```javascript
// In startGenerationProcess function, replace:
await new Promise(resolve => setTimeout(resolve, 2000));

// With:
const falResponse = await fal.subscribe("fal-ai/flux/schnell", {
  input: {
    prompt: prompt,
    image_size: "square_hd",
    num_inference_steps: 4,
    enable_safety_checker: true
  }
});

const generatedUrl = falResponse.data.images[0].url;
const fileSize = falResponse.data.images[0].file_size;
```

## Monitoring & Statistics

### View Generation Statistics
```sql
-- See generation stats and API call savings
SELECT * FROM get_generation_stats();

-- See most requested prompts
SELECT 
  prompt,
  dimensions,
  format,
  total_requests,
  api_calls_made,
  (total_requests - api_calls_made) as api_calls_saved,
  status,
  created_at
FROM public.generation_status 
ORDER BY total_requests DESC 
LIMIT 10;
```

### Add Statistics Endpoint
```javascript
app.get('/api/generation/stats', async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_generation_stats');
    if (error) throw error;
    
    res.json({
      success: true,
      stats: data[0],
      message: `Saved ${data[0].total_api_calls_saved} API calls today!`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});
```

## Cost Savings Example

### VRChat Scenario: 10 Users Load Same Link
**Before Queue System:**
- 10 users × 1 API call each = 10 FAL AI API calls
- Cost: 10 × $0.05 = $0.50

**After Queue System:**
- 10 users × 1 shared API call = 1 FAL AI API call
- Cost: 1 × $0.05 = $0.05
- **Savings: 90% reduction in API costs!**

### Real-World Example
If you have 100 VRChat users per day requesting images:
- **Before**: 100 API calls = $5.00/day
- **After**: ~20 unique prompts = $1.00/day
- **Monthly Savings**: $120!

## Advanced Features

### 1. Priority Queue
```javascript
// Add priority based on user subscription level
const priority = apiKeyData?.subscription_tier === 'premium' ? 1 : 2;
```

### 2. Generation Timeout
```javascript
// Current: 30 seconds max wait
const maxWaitTime = 30000;

// Adjust based on your FAL AI response times
const maxWaitTime = 60000; // 1 minute for complex generations
```

### 3. Batch Processing
```javascript
// Process multiple prompts in batch to FAL AI
const batchPrompts = await getPendingPrompts(5); // Get 5 pending prompts
const batchResponse = await fal.batchGenerate(batchPrompts);
```

### 4. Smart Caching
```javascript
// Cache based on similarity, not exact match
const similarPrompts = await findSimilarPrompts(prompt, 0.8); // 80% similarity
if (similarPrompts.length > 0) {
  return res.redirect(similarPrompts[0].generated_url);
}
```

## Troubleshooting

### Common Issues

#### 1. Users Getting Timeouts
```javascript
// Increase timeout for slow generations
const maxWaitTime = 60000; // 1 minute
```

#### 2. Database Locks
```sql
-- Check for long-running generations
SELECT * FROM public.generation_status 
WHERE status = 'generating' 
AND started_at < NOW() - INTERVAL '5 minutes';
```

#### 3. Memory Issues
```javascript
// Cleanup old generation status entries
await supabase.rpc('cleanup_old_generation_status');
```

### Performance Monitoring
```bash
# Check server logs for queue performance
fly logs | grep "Generation Status"

# Monitor database performance
fly ssh console
psql $DATABASE_URL
SELECT * FROM get_generation_stats();
```

## Next Steps

1. ✅ **Run database setup** - Execute both SQL files
2. ✅ **Deploy updated server** - Includes queuing system
3. ✅ **Test with multiple requests** - Verify only 1 API call per unique prompt
4. 🔄 **Integrate FAL AI** - Replace placeholder with actual API calls
5. 📊 **Monitor savings** - Track API call reduction
6. 🎯 **Optimize for VRChat** - Fine-tune based on usage patterns

## Expected Results

- **90% reduction** in API costs for duplicate requests
- **Instant response** for cached images
- **Seamless experience** for VRChat users
- **Automatic scaling** based on demand
- **Real-time monitoring** of cost savings

Your VRChat users will get the same great experience while you save massive amounts on API costs! 🎉
