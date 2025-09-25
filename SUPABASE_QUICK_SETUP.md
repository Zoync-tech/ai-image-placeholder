# 🚀 Quick Supabase Setup Guide

## 🔍 **Current Issue:**
Your users are being stored in memory instead of Supabase database. This means:
- ✅ System works but data is lost on server restart
- ❌ No persistent storage
- ❌ Users not visible in Supabase dashboard

## 🎯 **Quick Fix Steps:**

### **Step 1: Check Current Status**
Visit: `https://your-app.vercel.app/api/supabase-status`

This will show you exactly what's missing.

### **Step 2: Create Supabase Project**

1. **Go to [Supabase.com](https://supabase.com)**
2. **Sign up/Login** with your account
3. **Click "New Project"**
4. **Fill in details:**
   - Organization: Choose your org
   - Project name: `ai-image-placeholder`
   - Database password: Create a strong password (save it!)
   - Region: Choose closest to your users

5. **Click "Create new project"**
6. **Wait 2-3 minutes** for setup to complete

### **Step 3: Get Your Credentials**

1. **Go to Project Settings** (gear icon in left sidebar)
2. **Click "API" tab**
3. **Copy these values:**
   - **Project URL**: `https://your-project-id.supabase.co`
   - **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long string)

### **Step 4: Set Up Database Schema**

1. **Go to SQL Editor** in your Supabase dashboard
2. **Click "New query"**
3. **Copy and paste** the contents of `supabase-schema.sql`
4. **Click "Run"** to create all tables

### **Step 5: Configure Vercel Environment Variables**

1. **Go to [Vercel Dashboard](https://vercel.com)**
2. **Select your project**
3. **Go to Settings → Environment Variables**
4. **Add these variables:**

   ```
   Name: SUPABASE_URL
   Value: https://your-project-id.supabase.co
   ```

   ```
   Name: SUPABASE_SERVICE_ROLE_KEY
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

5. **Click "Save"**
6. **Redeploy your application**

### **Step 6: Verify Setup**

1. **Visit:** `https://your-app.vercel.app/api/supabase-status`
2. **Should show:**
   ```json
   {
     "configured": true,
     "connection": "SUCCESS",
     "url": "SET",
     "service_key": "SET"
   }
   ```

## 🔧 **Alternative: Use In-Memory Storage (Temporary)**

If you want to test without Supabase setup:

1. **The system already works** with in-memory storage
2. **Users will be created** and stored temporarily
3. **Data will be lost** on server restart
4. **Perfect for testing** the verification flow

## 📊 **What You'll See After Setup:**

### **In Supabase Dashboard:**
- **Users table** with user profiles
- **API Keys table** with generated keys
- **Sessions table** with active sessions
- **Email Verifications table** with pending codes

### **In Your App:**
- **Persistent user data** survives server restarts
- **Real database storage** instead of memory
- **Scalable solution** for production

## 🆘 **Troubleshooting:**

### **If Supabase Status Shows "NOT_CONFIGURED":**
- Check environment variables in Vercel
- Make sure you copied the correct values
- Redeploy after setting variables

### **If Connection Shows "FAILED":**
- Check your Supabase project URL
- Verify the service role key
- Make sure the database schema was created

### **If Users Still Not Saving:**
- Check the Vercel logs for error messages
- Verify the database tables exist
- Test the connection with the status endpoint

## 🎯 **Expected Timeline:**
- **Supabase Project Creation**: 2-3 minutes
- **Database Schema Setup**: 1 minute
- **Vercel Environment Variables**: 2 minutes
- **Redeploy and Test**: 2-3 minutes
- **Total Time**: ~8-10 minutes

## ✅ **Success Indicators:**
- ✅ Supabase status shows `"configured": true`
- ✅ Connection shows `"SUCCESS"`
- ✅ Users appear in Supabase dashboard
- ✅ User profile endpoint works
- ✅ Data persists after server restart

---

**Need help?** Check the `/api/supabase-status` endpoint for detailed diagnostics!
