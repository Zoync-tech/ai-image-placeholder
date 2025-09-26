# Supabase Connection Fix for Hosted Website

## Problem
Your hosted website at `https://www.vrccim.com` is getting 401 errors because it can't connect to Supabase properly.

## Root Cause
The hosted server doesn't have the correct Supabase environment variables configured.

## Solution

### 1. Environment Variables Setup
Make sure your hosting platform (Vercel, Netlify, etc.) has these environment variables set:

```bash
SUPABASE_URL=https://oefhoywofsuarvkucexx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lZmhveXdvZnN1YXJ2a3VjZXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MjM5MDEsImV4cCI6MjA3NDM5OTkwMX0.QKUGYw2iVguOSimr2GzB-jMZFNLCRI5F6W5CfA72-xQ
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lZmhveXdvZnN1YXJ2a3VjZXh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODgyMzkwMSwiZXhwIjoyMDc0Mzk5OTAxfQ.I4ZtI8oUskvbF8jSKr7rW8w4AeSVuilqbqQev6saM7M
RESEND_API_KEY=re_2hjEnGgj_FRr1Zi3CBZEDMmv5PXsYuvnZ
FAL_KEY=789ca5d1-1581-44e1-89c5-c2a91f6e26f3:1e7597e245d48ad2f5a521334a140e32
PORT=3000
```

### 2. Vercel Deployment
If using Vercel:

1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add each variable above
5. Redeploy your project

### 3. Netlify Deployment
If using Netlify:

1. Go to your Netlify dashboard
2. Select your site
3. Go to Site settings → Environment variables
4. Add each variable above
5. Trigger a new deploy

### 4. Other Hosting Platforms
For other platforms, add the environment variables in their respective settings and redeploy.

### 5. Verify Connection
After deployment, check:
- Login functionality works
- API endpoints respond correctly
- No more 401 errors

## Testing Locally
To test locally, create a `.env` file with the variables above and run:
```bash
node server.js
```

## Common Issues
1. **Missing SUPABASE_URL**: Must be full URL `https://project-id.supabase.co`
2. **Wrong Keys**: Make sure you're using the correct anon and service role keys
3. **CORS Issues**: Supabase should automatically handle CORS for your domain
4. **Database Permissions**: Ensure your service role key has proper permissions

## Debug Steps
1. Check server logs for Supabase connection errors
2. Verify environment variables are loaded correctly
3. Test Supabase connection with a simple query
4. Check network tab in browser for specific error details
