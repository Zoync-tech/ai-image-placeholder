# Complete Supabase Setup Guide

This guide will help you set up the complete Supabase database with all required functions.

## Step 1: Reset Your Database

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Run the complete schema:

```sql
-- Copy and paste the entire contents of supabase-schema-complete.sql
```

## Step 2: Verify the Setup

After running the schema, you should see:

### Tables Created:
- ✅ `users` - User accounts with credits and generations
- ✅ `api_keys` - API keys linked to users
- ✅ `sessions` - User login sessions
- ✅ `email_verifications` - Email verification codes
- ✅ `image_generations` - Generated images with storage info

### Functions Created:
- ✅ `deduct_credit()` - Deducts credits from users
- ✅ `cleanup_expired_sessions()` - Removes expired sessions
- ✅ `cleanup_expired_verifications()` - Removes expired verification codes
- ✅ `update_updated_at_column()` - Updates timestamp triggers

### Policies Created:
- ✅ Row Level Security enabled on all tables
- ✅ Service role has full access to all tables
- ✅ Users can only access their own data

## Step 3: Test the Connection

1. Go to your local project
2. Make sure your `.env` file has the correct Supabase credentials
3. Start your server: `node server.js`
4. Check the health endpoint: `http://localhost:3000/health`

You should see:
```json
{
  "status": "healthy",
  "supabase": "configured",
  "resend": "configured"
}
```

## Step 4: Test Email Verification

1. Go to `http://localhost:3000/auth`
2. Sign up with a new email
3. Check your email for the verification code
4. Enter the code to verify your account

## Troubleshooting

### If you get "relation does not exist" errors:
- Make sure you ran the complete schema file
- Check that all tables were created successfully

### If you get permission errors:
- Verify your service role key is correct
- Check that the service role policies were created

### If email verification still fails:
- Check the server logs for detailed error messages
- Verify your Resend API key is working
- Test with the `/api/debug-verification` endpoint

## What's Fixed

This complete schema includes:

1. **All Required Tables** - Users, API keys, sessions, email verifications, image generations
2. **Credit Management** - Proper `deduct_credit()` function
3. **Storage Integration** - Fields for Supabase Storage paths and URLs
4. **Proper Permissions** - Service role can access all data
5. **Row Level Security** - Users can only see their own data
6. **Cleanup Functions** - Automatic cleanup of expired data
7. **Triggers** - Automatic timestamp updates

The schema is now complete and should resolve all login and verification issues!

