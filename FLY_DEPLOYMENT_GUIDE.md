# 🚀 Fly.io Deployment Guide

## Prerequisites
- ✅ Fly CLI installed (`fly version`)
- ✅ Logged into Fly (`fly auth whoami`)
- ✅ Docker installed (for local testing)

## Deployment Steps

### Step 1: Initialize Fly App (if not already done)
```bash
fly launch --no-deploy
```

### Step 2: Set Environment Variables
Set all your environment variables in Fly:

```bash
# Supabase Configuration
fly secrets set SUPABASE_URL="your_supabase_url_here"
fly secrets set SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"
fly secrets set SUPABASE_ANON_KEY="your_anon_key_here"

# Stripe Configuration (if using payments)
fly secrets set STRIPE_SECRET_KEY="your_stripe_secret_key_here"
fly secrets set STRIPE_PUBLISHABLE_KEY="your_stripe_publishable_key_here"
fly secrets set STRIPE_WEBHOOK_SECRET="your_webhook_secret_here"

# Optional: Custom domain
fly secrets set CUSTOM_DOMAIN="your-domain.com"
```

### Step 3: Deploy to Fly
```bash
fly deploy
```

### Step 4: Set Up Custom Domain (Optional)
```bash
# Add your domain
fly certs add your-domain.com

# Check certificate status
fly certs show your-domain.com
```

## Configuration Files Created

### `fly.toml`
- App name: `ai-image-generator`
- Region: `iad` (US East)
- Port: `8080`
- Health check: `/health`
- Auto-scaling enabled

### `Dockerfile`
- Node.js 18 Alpine base
- Production dependencies only
- Non-root user for security
- Health check included

### `.dockerignore`
- Excludes development files
- Reduces image size
- Improves build speed

## Post-Deployment Setup

### 1. Run Database Cache Setup
Execute `database-cache-setup.sql` in your Supabase SQL editor to enable the cache system.

### 2. Test Your Deployment
```bash
# Health check
curl https://your-app-name.fly.dev/health

# Test image generation
curl "https://your-app-name.fly.dev/1024x1024.jpg?text=Hello%20World"

# Test cache system (run twice to see cache hit)
curl "https://your-app-name.fly.dev/1024x1024.jpg?text=A%20beautiful%20sunset"
```

### 3. Monitor Your App
```bash
# View logs
fly logs

# Check app status
fly status

# Scale your app
fly scale count 2  # Run 2 instances
```

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | ✅ |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ |
| `STRIPE_SECRET_KEY` | Stripe secret key | ❌ |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | ❌ |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | ❌ |

## Troubleshooting

### Build Issues
```bash
# Check build logs
fly logs --build

# Test Docker build locally
docker build -t ai-image-generator .
docker run -p 8080:8080 ai-image-generator
```

### Runtime Issues
```bash
# Check app logs
fly logs

# SSH into your app
fly ssh console

# Check app status
fly status
```

### Database Connection Issues
1. Verify Supabase environment variables are set
2. Check Supabase project is active
3. Ensure RLS policies are configured
4. Run `database-cache-setup.sql` if cache isn't working

## Performance Optimization

### Scaling
```bash
# Scale horizontally (more instances)
fly scale count 3

# Scale vertically (more resources)
fly scale memory 1024
fly scale cpu 2
```

### Monitoring
```bash
# View metrics
fly metrics

# Check resource usage
fly status
```

## Cost Optimization

### Auto-scaling
- `min_machines_running = 0` - Scales to zero when idle
- `auto_stop_machines = true` - Stops unused machines
- `auto_start_machines = true` - Starts machines on demand

### Resource Limits
- CPU: 1 shared CPU
- Memory: 512MB
- Perfect for image generation workloads

## Security Features

### Non-root User
- Dockerfile runs as `nodejs` user (UID 1001)
- No root privileges in container

### HTTPS Only
- `force_https = true` in fly.toml
- Automatic SSL certificates

### Health Checks
- Built-in health check endpoint
- Automatic restart on failure

## Next Steps After Deployment

1. ✅ **Test the cache system** - Verify duplicate requests return cached results
2. ✅ **Set up monitoring** - Monitor API costs and cache hit rates
3. ✅ **Configure FAL AI** - Replace placeholder with actual FAL AI integration
4. ✅ **Set up alerts** - Monitor for errors and high usage
5. ✅ **Optimize performance** - Fine-tune based on usage patterns

## Support

- Fly.io Documentation: https://fly.io/docs/
- Fly.io Community: https://community.fly.io/
- Your app will be available at: `https://ai-image-generator.fly.dev`

Happy deploying! 🚀
