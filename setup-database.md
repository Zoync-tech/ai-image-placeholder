# 🗄️ Database Setup Guide

## Step 1: Reset Database (if tables already exist)

If you're getting "relation already exists" errors:

1. **Go to your Supabase dashboard**
2. **Navigate to SQL Editor**
3. **Copy and paste** the contents of `database-reset.sql`
4. **Click "Run"** to reset the database

## Step 2: Fresh Setup (if no tables exist)

If this is your first time setting up:

1. **Go to your Supabase dashboard**
2. **Navigate to SQL Editor**
3. **Copy and paste** the contents of `database-schema-simple.sql`
4. **Click "Run"** to create the tables

## Step 3: Verify Setup

After running either script, you should see:

✅ **Tables created:**
- `profiles` - User profiles with credits
- `api_keys` - User API keys
- `image_generations` - Generation history

✅ **Policies created:**
- Row Level Security enabled
- Users can only access their own data

✅ **Functions created:**
- `update_updated_at_column()` - Auto-updates timestamps

## Step 4: Test the Setup

1. **Go to your Vercel deployment**
2. **Test the health endpoint:**
   ```
   https://your-domain.vercel.app/health
   ```

3. **Test image generation (fallback mode):**
   ```
   https://your-domain.vercel.app/600x400.jpg?text=test
   ```

## Step 5: Set Up Authentication (Optional)

If you want to enable the full authentication system:

1. **Set environment variables in Vercel:**
   ```
   SUPABASE_URL=your-supabase-url
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. **Redeploy your Vercel app**

3. **Visit the dashboard:**
   ```
   https://your-domain.vercel.app/dashboard.html
   ```

## Troubleshooting

### "relation already exists" error
- Use `database-reset.sql` to start fresh

### "must be owner of table users" error
- This is normal - Supabase manages the `auth.users` table
- The reset script handles this properly

### Environment variables not working
- Make sure all variables are set in Vercel
- Redeploy after adding variables
- Check the Vercel function logs for errors

## What Each Table Does

### `profiles`
- Stores user information
- Tracks remaining credits (default: 5)
- Links to Supabase auth users

### `api_keys`
- User's API keys for image generation
- Tracks usage statistics
- Can be created/deleted by users

### `image_generations`
- Logs all image generation attempts
- Tracks success/failure
- Used for analytics and debugging

Your database is now ready for the AI Image Placeholder service! 🚀
