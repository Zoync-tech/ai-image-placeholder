# 💳 Stripe Payment Integration Setup Guide

This guide will help you set up Stripe payments for your AI Image Generator with subscription plans and credit refills.

## 📋 Overview

Your payment system includes:
- **Basic Plan**: $10/month for 100 credits
- **Premium Plan**: $25/month for 300 credits  
- **Credit Refill**: $5 for 35 additional credits (subscribers only)
- **Plan Upgrades**: Prorated billing for upgrades
- **Plan Downgrades**: Effective at end of billing period

## 🚀 Step 1: Stripe Account Setup

1. **Create Stripe Account**
   - Go to [stripe.com](https://stripe.com) and create an account
   - Complete the account verification process

2. **Get API Keys**
   - Go to [Stripe Dashboard > Developers > API keys](https://dashboard.stripe.com/apikeys)
   - Copy your **Publishable key** (starts with `pk_test_` or `pk_live_`)
   - Copy your **Secret key** (starts with `sk_test_` or `sk_live_`)

3. **Set Environment Variables**
   ```bash
   # Add to your .env file
   STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
   STRIPE_SECRET_KEY=sk_test_your_secret_key_here
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   ```

## 🗄️ Step 2: Database Setup

1. **Update Database Schema**
   ```bash
   # Run the new schema with subscription support
   node -e "
   const fs = require('fs');
   const schema = fs.readFileSync('database-schema-with-subscriptions.sql', 'utf8');
   console.log('Copy this SQL to your Supabase SQL Editor:');
   console.log(schema);
   "
   ```

2. **Apply Schema in Supabase**
   - Go to your Supabase Dashboard
   - Navigate to SQL Editor
   - Paste and run the schema from `database-schema-with-subscriptions.sql`

## ⚙️ Step 3: Install Dependencies

```bash
npm install stripe
```

## 🎯 Step 4: Create Stripe Plans

Run the setup script to create your subscription plans:

```bash
node setup-stripe-plans.js
```

This will:
- Create products and prices in Stripe
- Set up the database table for price references
- Configure the credit system

## 🔗 Step 5: Set Up Webhooks

1. **Create Webhook Endpoint**
   - Go to [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/webhooks)
   - Click "Add endpoint"
   - Set URL to: `https://your-domain.com/api/stripe/webhook`
   - Select these events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

2. **Get Webhook Secret**
   - After creating the webhook, click on it
   - Copy the "Signing secret" (starts with `whsec_`)
   - Add it to your environment variables

## 🖥️ Step 6: Update Server

Replace your current server with the Stripe-enabled version:

```bash
# Backup your current server
cp server.js server-backup.js

# Use the new server with Stripe support
cp server-with-stripe.js server.js
```

## 🧪 Step 7: Test the Integration

1. **Start the Server**
   ```bash
   npm start
   ```

2. **Test Subscription Flow**
   - Go to `http://localhost:3000/subscription.html`
   - Try subscribing to a plan (use Stripe test cards)
   - Verify credits are added to your account

3. **Test Credit Refill**
   - Subscribe to a plan first
   - Try purchasing a credit refill
   - Verify additional credits are added

## 💳 Test Cards

Use these Stripe test cards for testing:

```
# Successful payment
4242 4242 4242 4242

# Declined payment
4000 0000 0000 0002

# Requires authentication
4000 0025 0000 3155
```

## 🔧 Step 8: Production Deployment

1. **Switch to Live Mode**
   - In Stripe Dashboard, toggle to "Live mode"
   - Get your live API keys
   - Update environment variables

2. **Update Webhook URL**
   - Change webhook URL to your production domain
   - Update the webhook secret

3. **Deploy to Vercel**
   ```bash
   # Set environment variables in Vercel
   vercel env add STRIPE_PUBLISHABLE_KEY
   vercel env add STRIPE_SECRET_KEY
   vercel env add STRIPE_WEBHOOK_SECRET

   # Deploy
   vercel --prod
   ```

## 📊 Step 9: Monitor and Manage

1. **Stripe Dashboard**
   - Monitor payments and subscriptions
   - Handle failed payments
   - View customer data

2. **Your Application**
   - Check subscription status at `/subscription.html`
   - Monitor credit usage
   - Handle subscription changes

## 🎯 Features Included

### Subscription Plans
- **Basic Plan**: $10/month, 100 credits
- **Premium Plan**: $25/month, 300 credits
- Automatic monthly billing
- Credit expiration at end of billing period

### Credit Refills
- **$5 Refill**: 35 additional credits
- Only available to active subscribers
- One-time purchase

### Plan Management
- **Upgrade**: Immediate upgrade with prorated billing
- **Downgrade**: Effective at end of current period
- **Cancel**: Access until end of billing period

### Credit System
- Credits expire monthly
- Automatic credit allocation
- Usage tracking
- Insufficient credit handling

## 🚨 Troubleshooting

### Common Issues

1. **Webhook Not Working**
   - Check webhook URL is accessible
   - Verify webhook secret is correct
   - Check server logs for errors

2. **Credits Not Adding**
   - Verify webhook events are being received
   - Check database for subscription records
   - Ensure user has active subscription

3. **Payment Failing**
   - Check Stripe dashboard for error details
   - Verify API keys are correct
   - Test with different test cards

### Debug Commands

```bash
# Check Stripe configuration
node -e "console.log('Stripe configured:', !!process.env.STRIPE_SECRET_KEY)"

# Test webhook endpoint
curl -X POST http://localhost:3000/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "webhook"}'

# Check database connection
node -e "
const { supabase } = require('./supabase-config');
supabase.from('profiles').select('count').then(console.log);
"
```

## 📞 Support

If you encounter issues:
1. Check the server logs
2. Verify Stripe dashboard for payment status
3. Check Supabase for data consistency
4. Test with Stripe test cards first

## 🎉 Success!

Once everything is working:
- Users can subscribe to plans
- Credits are automatically managed
- Payments are processed securely
- Subscriptions can be managed
- Credit refills are available

Your AI Image Generator now has a complete payment system! 🚀
