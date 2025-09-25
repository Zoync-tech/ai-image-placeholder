# 🚀 Deployment Guide

This guide covers deploying your AI Image Placeholder service to various platforms.

## 📋 Prerequisites

- Node.js 18+ installed
- Git repository set up
- FAL AI API key (for full functionality)

## 🌐 GitHub Pages (Static Demo)

### Option 1: Automatic Deployment with GitHub Actions

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Enable GitHub Pages:**
   - Go to your repository settings
   - Navigate to "Pages" section
   - Select "Deploy from a branch"
   - Choose "gh-pages" branch
   - Save settings

3. **Your site will be available at:**
   ```
   https://yourusername.github.io/ai-image-placeholder
   ```

### Option 2: Manual Deployment

1. **Build the static site:**
   ```bash
   npm run build
   ```

2. **Deploy to GitHub Pages:**
   ```bash
   npm install gh-pages --save-dev
   npm run deploy
   ```

3. **Enable GitHub Pages in repository settings**

## 🔥 Heroku (Full Backend + Frontend)

1. **Install Heroku CLI:**
   ```bash
   # Download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Login and create app:**
   ```bash
   heroku login
   heroku create your-app-name
   ```

3. **Set environment variables:**
   ```bash
   heroku config:set FAL_KEY=your-fal-api-key
   heroku config:set PORT=3000
   ```

4. **Deploy:**
   ```bash
   git push heroku main
   ```

5. **Your app will be available at:**
   ```
   https://your-app-name.herokuapp.com
   ```

## ⚡ Vercel (Serverless)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Create vercel.json:**
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "server.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "server.js"
       }
     ],
     "env": {
       "FAL_KEY": "@fal-key"
     }
   }
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

4. **Set environment variables in Vercel dashboard**

## 🚂 Railway

1. **Connect GitHub repository to Railway**
2. **Set environment variables:**
   - `FAL_KEY`: Your FAL AI API key
   - `PORT`: 3000 (auto-set by Railway)

3. **Deploy automatically on git push**

## 🌊 Netlify (Frontend Only)

1. **Build static site:**
   ```bash
   npm run build
   ```

2. **Deploy to Netlify:**
   - Drag and drop the `dist` folder to Netlify
   - Or connect your GitHub repository

3. **Set up redirects for API calls to your backend**

## 🐳 Docker Deployment

1. **Create Dockerfile:**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Build and run:**
   ```bash
   docker build -t ai-image-placeholder .
   docker run -p 3000:3000 -e FAL_KEY=your-key ai-image-placeholder
   ```

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `FAL_KEY` | Your FAL AI API key | Yes |
| `PORT` | Server port | No (default: 3000) |

## 📊 Performance Considerations

### For GitHub Pages (Static):
- ✅ Fast loading
- ❌ No backend functionality
- ❌ No AI image generation
- ✅ Perfect for demos and documentation

### For Full Deployments:
- ✅ Complete functionality
- ✅ AI image generation
- ✅ Caching
- ⚠️ Requires API key management
- ⚠️ Server costs

## 🛠️ Troubleshooting

### Common Issues:

1. **API Key Not Working:**
   - Verify your FAL AI API key is correct
   - Check environment variables are set properly

2. **Images Not Generating:**
   - Check server logs for errors
   - Verify network connectivity
   - Ensure API key has sufficient credits

3. **GitHub Pages Not Updating:**
   - Check GitHub Actions logs
   - Verify branch settings
   - Clear browser cache

### Debug Commands:

```bash
# Test local server
npm start

# Test API endpoints
npm test

# Check environment variables
echo $FAL_KEY

# Build for production
npm run build
```

## 📈 Monitoring

### Recommended Tools:
- **Uptime Monitoring:** UptimeRobot, Pingdom
- **Error Tracking:** Sentry, LogRocket
- **Analytics:** Google Analytics, Plausible
- **Performance:** Lighthouse, WebPageTest

## 🔒 Security

### Best Practices:
- Never commit API keys to version control
- Use environment variables for sensitive data
- Enable HTTPS for all deployments
- Set up rate limiting for production
- Monitor API usage and costs

## 💰 Cost Estimation

### GitHub Pages:
- ✅ Free for public repositories
- ✅ Free for private repositories (limited)

### Heroku:
- 💰 $7/month for hobby tier
- 💰 $25/month for standard tier

### Vercel:
- ✅ Free tier available
- 💰 $20/month for pro tier

### Railway:
- ✅ $5 credit monthly
- 💰 Pay-per-use after credit

Choose the deployment option that best fits your needs and budget!
