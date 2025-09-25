# 🚀 Vercel Deployment Guide

Deploy your AI Image Placeholder service to Vercel for full functionality with AI image generation.

## 📋 Prerequisites

- Vercel account (free at [vercel.com](https://vercel.com))
- FAL AI API key
- Git repository

## 🚀 Method 1: Deploy via Vercel Dashboard (Recommended)

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Add Vercel deployment configuration"
git push origin main
```

### Step 2: Import Project in Vercel

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Vercel will auto-detect it's a Node.js project

### Step 3: Configure Environment Variables

1. In your project settings, go to "Environment Variables"
2. Add the following variable:
   - **Name**: `FAL_KEY`
   - **Value**: `789ca5d1-1581-44e1-89c5-c2a91f6e26f3:1e7597e245d48ad2f5a521334a140e32`
   - **Environment**: Production, Preview, Development

### Step 4: Deploy

1. Click "Deploy"
2. Wait for deployment to complete
3. Your site will be live at: `https://your-project-name.vercel.app`

## 🛠️ Method 2: Deploy via Vercel CLI

### Step 1: Install Vercel CLI

```bash
npm i -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Deploy

```bash
# Deploy to production
vercel --prod

# Or deploy for preview
vercel
```

### Step 4: Set Environment Variables

```bash
vercel env add FAL_KEY
# Enter your API key when prompted
```

## 🔧 Configuration Details

### vercel.json Configuration

The `vercel.json` file configures:
- **Serverless Functions**: Routes all requests to `server.js`
- **Timeout**: 30 seconds for image generation
- **Environment Variables**: Automatic FAL_KEY injection

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `FAL_KEY` | Your FAL AI API key | Yes |
| `NODE_ENV` | Set to 'production' | Auto-set by Vercel |

## 📊 Vercel Features

### ✅ What You Get:

- **Free Tier**: 100GB bandwidth, 1000 serverless function executions
- **Automatic HTTPS**: SSL certificates included
- **Global CDN**: Fast loading worldwide
- **Automatic Deployments**: Deploy on every git push
- **Preview Deployments**: Test changes before going live
- **Custom Domains**: Add your own domain name

### 🚀 Performance Benefits:

- **Edge Functions**: Deploy close to your users
- **Automatic Scaling**: Handle traffic spikes
- **Zero Configuration**: Works out of the box
- **Built-in Analytics**: Monitor performance

## 🎯 Usage After Deployment

### Your Live URLs:

```
# Main site
https://your-project-name.vercel.app

# Generate images
https://your-project-name.vercel.app/600x400?text=Hello+World
https://your-project-name.vercel.app/800x600?text=a%20beautiful%20sunset

# Health check
https://your-project-name.vercel.app/health
```

### Example Usage:

```html
<!-- In your HTML -->
<img src="https://your-project-name.vercel.app/600x400?text=a%20cute%20cat" alt="AI Generated Cat">

<!-- CSS background -->
<div style="background-image: url('https://your-project-name.vercel.app/1200x800?text=abstract%20art')">
```

## 🔍 Testing Your Deployment

### 1. Test Health Endpoint
```bash
curl https://your-project-name.vercel.app/health
```

### 2. Test Image Generation
```bash
curl "https://your-project-name.vercel.app/600x400?text=test" -o test-image.jpg
```

### 3. Test Web Interface
Visit: `https://your-project-name.vercel.app`

## 🛠️ Troubleshooting

### Common Issues:

1. **Environment Variables Not Set**
   - Check Vercel dashboard → Settings → Environment Variables
   - Redeploy after adding variables

2. **Function Timeout**
   - Image generation can take 10-30 seconds
   - Vercel has 30-second timeout on free tier
   - Consider upgrading for longer timeouts

3. **API Key Issues**
   - Verify FAL AI API key is correct
   - Check API key has sufficient credits

### Debug Commands:

```bash
# Check deployment logs
vercel logs https://your-project-name.vercel.app

# Check function logs
vercel logs --function=server.js
```

## 📈 Monitoring & Analytics

### Vercel Analytics:
- View in Vercel dashboard
- Track page views, function calls, bandwidth
- Monitor performance metrics

### Recommended Additions:
- **Error Tracking**: Sentry integration
- **Uptime Monitoring**: UptimeRobot
- **Performance**: Lighthouse CI

## 💰 Cost Information

### Vercel Free Tier:
- ✅ 100GB bandwidth/month
- ✅ 1000 serverless function executions/day
- ✅ Custom domains
- ✅ Automatic HTTPS

### Upgrades Available:
- **Pro**: $20/month for higher limits
- **Enterprise**: Custom pricing

## 🔒 Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for sensitive data
3. **Enable Vercel's security headers**
4. **Monitor usage** to prevent abuse
5. **Set up rate limiting** if needed

## 🚀 Next Steps

After successful deployment:

1. **Custom Domain**: Add your own domain in Vercel settings
2. **Analytics**: Enable Vercel Analytics
3. **Monitoring**: Set up error tracking
4. **Optimization**: Monitor and optimize performance
5. **Documentation**: Share your live URL!

Your AI Image Placeholder service will be fully functional with real AI image generation! 🎨✨
