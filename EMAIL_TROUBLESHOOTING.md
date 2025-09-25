# 📧 Email Troubleshooting Guide

## 🚨 Common Issues & Solutions

### **Issue 1: "from" Domain Not Verified**

**Problem:** Resend requires a verified domain for the `from` address.

**Current Configuration:**
```javascript
from: 'AI Image Placeholder <noreply@aiimageplaceholder.com>'
```

**Solutions:**

#### **Option A: Use Resend's Default Domain (Quick Fix)**
```javascript
from: 'AI Image Placeholder <onboarding@resend.dev>'
```

#### **Option B: Verify Your Own Domain (Recommended)**
1. **Go to Resend Dashboard** → **Domains**
2. **Add your domain** (e.g., `yourdomain.com`)
3. **Add DNS records** as instructed
4. **Wait for verification** (can take up to 24 hours)
5. **Update the from address** to use your verified domain

#### **Option C: Use Your Email Address**
```javascript
from: 'AI Image Placeholder <your-email@yourdomain.com>'
```

### **Issue 2: API Key Not Set in Vercel**

**Problem:** Environment variable not configured in production.

**Solution:**
1. **Go to Vercel Dashboard**
2. **Select your project**
3. **Settings** → **Environment Variables**
4. **Add:** `RESEND_API_KEY` = `re_2hjEnGgj_FRr1Zi3CBZEDMmv5PXsYuvnZ`
5. **Redeploy** your application

### **Issue 3: Email Going to Spam**

**Common Causes:**
- Unverified domain
- Missing SPF/DKIM records
- Generic "from" address

**Solutions:**
- Use a verified domain
- Set up proper DNS records
- Use a professional "from" name

### **Issue 4: API Rate Limits**

**Problem:** Resend has rate limits for free accounts.

**Limits:**
- **Free tier:** 100 emails/day
- **Pro tier:** 50,000 emails/day

**Solution:** Upgrade to Pro if needed

### **Issue 5: Invalid Email Address**

**Problem:** Email address format is invalid.

**Check:**
- Email format is correct
- No typos in the address
- Domain exists and is valid

## 🔧 Quick Fixes

### **Fix 1: Update Server Configuration**

Update the `from` address in `server.js`:

```javascript
// Change this line in server.js around line 438
from: 'AI Image Placeholder <onboarding@resend.dev>', // Use Resend's default domain
```

### **Fix 2: Add Better Error Logging**

The server already has error logging, but you can check the Vercel logs:

1. **Go to Vercel Dashboard**
2. **Functions** tab
3. **View logs** for your deployment
4. **Look for email sending errors**

### **Fix 3: Test Email Configuration**

Create a test endpoint to verify email setup:

```javascript
app.post('/api/test-email', async (req, res) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'AI Image Placeholder <onboarding@resend.dev>',
      to: ['your-email@example.com'],
      subject: 'Test Email',
      html: '<p>This is a test email from your AI Image Placeholder service.</p>'
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, messageId: data.id });
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

## 📋 Step-by-Step Troubleshooting

### **Step 1: Check Vercel Environment Variables**
```bash
# In Vercel Dashboard, verify these are set:
RESEND_API_KEY=re_2hjEnGgj_FRr1Zi3CBZEDMmv5PXsYuvnZ
```

### **Step 2: Check Resend Dashboard**
1. **Login to Resend**
2. **Go to API Keys** - verify your key is active
3. **Go to Emails** - check if emails are being sent
4. **Go to Domains** - verify domain status

### **Step 3: Check Server Logs**
1. **Vercel Dashboard** → **Functions** → **View Logs**
2. **Look for these messages:**
   - `📧 Sending verification email to [email] via Resend`
   - `✅ Verification email sent successfully`
   - `❌ Failed to send verification email via Resend`

### **Step 4: Test with Resend's Default Domain**

Update your server to use Resend's default domain:

```javascript
from: 'AI Image Placeholder <onboarding@resend.dev>'
```

### **Step 5: Verify Email Address**
- Check for typos
- Try a different email address
- Check spam/junk folder

## 🚀 Immediate Fix

The quickest solution is to update the `from` address to use Resend's default domain:

1. **Edit `server.js`**
2. **Find line 438** (around the email sending function)
3. **Change:**
   ```javascript
   from: 'AI Image Placeholder <noreply@aiimageplaceholder.com>'
   ```
   **To:**
   ```javascript
   from: 'AI Image Placeholder <onboarding@resend.dev>'
   ```
4. **Deploy the changes**

## 📞 Getting Help

If emails still don't work:

1. **Check Resend Dashboard** for error messages
2. **Check Vercel logs** for server errors
3. **Verify API key** is correct and active
4. **Try a different email address**
5. **Check spam folder**

## ✅ Success Indicators

You'll know it's working when you see:
- `✅ Verification email sent successfully` in logs
- Email appears in Resend dashboard under "Emails"
- Email arrives in your inbox (not spam)
