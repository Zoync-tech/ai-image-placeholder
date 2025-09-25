# 🗄️ Supabase Setup Guide

This guide will help you set up Supabase for persistent user data storage.

## 🚀 Quick Setup

### 1. Create Supabase Project

1. **Go to [Supabase](https://supabase.com)**
2. **Sign up/Login** with your account
3. **Create New Project**
   - Choose your organization
   - Enter project name: `ai-image-placeholder`
   - Set a strong database password
   - Choose a region close to your users

### 2. Get Your Credentials

1. **Go to Project Settings** (gear icon)
2. **API Settings** tab
3. **Copy these values:**
   - `URL` (e.g., `https://your-project.supabase.co`)
   - `anon public` key
   - `service_role` key (keep this secret!)

### 3. Set Up Database Schema

1. **Go to SQL Editor** in your Supabase dashboard
2. **Create New Query**
3. **Copy and paste** the contents of `supabase-schema.sql`
4. **Run the query** to create all tables and functions

### 4. Configure Environment Variables

#### **For Local Development:**
Create a `.env` file:
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Resend Email Configuration
RESEND_API_KEY=re_2hjEnGgj_FRr1Zi3CBZEDMmv5PXsYuvnZ

# FAL AI Configuration
FAL_KEY=789ca5d1-1581-44e1-89c5-c2a91f6e26f3:1e7597e245d48ad2f5a521334a140e32
```

#### **For Vercel Deployment:**
1. **Go to Vercel Dashboard**
2. **Select your project**
3. **Settings → Environment Variables**
4. **Add these variables:**
   - `SUPABASE_URL` = `https://your-project.supabase.co`
   - `SUPABASE_ANON_KEY` = `your-anon-key`
   - `SUPABASE_SERVICE_ROLE_KEY` = `your-service-role-key`
   - `RESEND_API_KEY` = `re_2hjEnGgj_FRr1Zi3CBZEDMmv5PXsYuvnZ`
   - `FAL_KEY` = `789ca5d1-1581-44e1-89c5-c2a91f6e26f3:1e7597e245d48ad2f5a521334a140e32`

## 📊 Database Schema

### **Tables Created:**

1. **`users`** - User accounts and profiles
   - `id`, `email`, `name`, `email_verified`, `credits`, `total_generations`

2. **`api_keys`** - API keys for authentication
   - `api_key`, `user_id`, `name`, `is_active`, `total_requests`

3. **`sessions`** - User session tokens
   - `token`, `user_id`, `created_at`, `expires_at`

4. **`email_verifications`** - Email verification codes
   - `email`, `code`, `name`, `created_at`, `expires_at`

5. **`image_generations`** - Usage tracking
   - `user_id`, `api_key_id`, `prompt`, `dimensions`, `success`

### **Features Included:**

- ✅ **Row Level Security** - Users can only access their own data
- ✅ **Automatic Timestamps** - Created/updated timestamps
- ✅ **Credit Management** - Built-in credit deduction functions
- ✅ **Session Management** - Automatic session expiration
- ✅ **Performance Indexes** - Optimized database queries
- ✅ **Data Integrity** - Foreign key constraints and validation

## 🔧 Advanced Configuration

### **Enable Email Authentication (Optional):**

1. **Go to Authentication → Settings**
2. **Enable Email provider**
3. **Configure email templates**
4. **Set up custom SMTP** (optional)

### **Set Up Database Backups:**

1. **Go to Settings → Database**
2. **Enable Point-in-Time Recovery**
3. **Configure backup schedule**

### **Monitor Usage:**

1. **Go to Reports → Usage**
2. **Monitor API calls, storage, bandwidth**
3. **Set up alerts** for usage limits

## 🚨 Security Notes

### **Important:**
- **Never commit** `SUPABASE_SERVICE_ROLE_KEY` to version control
- **Use environment variables** for all sensitive data
- **Enable Row Level Security** (already configured)
- **Regular backups** recommended for production

### **Production Checklist:**
- [ ] Strong database password
- [ ] Environment variables set
- [ ] Row Level Security enabled
- [ ] Backup strategy configured
- [ ] Monitoring alerts set up
- [ ] SSL/TLS enabled (automatic with Supabase)

## 🔄 Fallback System

The system includes a **graceful fallback**:
- **If Supabase is not configured** → Uses in-memory storage
- **If Supabase connection fails** → Falls back to in-memory storage
- **No downtime** → System continues to work

## 📈 Benefits of Supabase

- ✅ **Persistent Storage** - Data survives server restarts
- ✅ **Real-time Updates** - Live data synchronization
- ✅ **Built-in Security** - Row Level Security and authentication
- ✅ **Automatic Scaling** - Handles growth automatically
- ✅ **Backup & Recovery** - Point-in-time recovery
- ✅ **Monitoring** - Built-in usage analytics
- ✅ **API Generation** - Automatic REST and GraphQL APIs

## 🆘 Troubleshooting

### **Common Issues:**

1. **"relation does not exist"**
   - Run the `supabase-schema.sql` script again
   - Check if tables were created in the correct schema

2. **"permission denied"**
   - Check Row Level Security policies
   - Verify service role key is correct

3. **"connection refused"**
   - Verify Supabase URL is correct
   - Check if project is paused or deleted

### **Getting Help:**
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- [Supabase GitHub](https://github.com/supabase/supabase)

---

**Your AI Image Placeholder service is now ready for production with persistent user data! 🎉**
