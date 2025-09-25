# Supabase Storage Setup Guide

This guide will help you set up Supabase Storage for saving generated AI images.

## 1. Create Storage Bucket

### Step 1: Go to Supabase Dashboard
1. Open your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**

### Step 2: Create the Bucket
- **Name**: `generated-images`
- **Public**: ✅ **Yes** (this allows public access to images)
- **File size limit**: `50 MB` (adjust as needed)
- **Allowed MIME types**: `image/jpeg, image/png`

### Step 3: Configure Bucket Settings
After creating the bucket:
1. Click on the `generated-images` bucket
2. Go to **Settings** tab
3. Set **Public bucket** to ✅ **Yes**
4. Save settings

## 2. Set Up Storage Policies

### Step 1: Go to Storage Policies
1. In your Supabase dashboard
2. Navigate to **Storage** → **Policies**
3. Click on the `generated-images` bucket

### Step 2: Create Upload Policy
Create a policy for uploading images:

**Policy Name**: `Allow authenticated users to upload images`
```sql
CREATE POLICY "Allow authenticated users to upload images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'generated-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### Step 3: Create View Policy
Create a policy for viewing images:

**Policy Name**: `Allow public access to images`
```sql
CREATE POLICY "Allow public access to images" ON storage.objects
FOR SELECT USING (bucket_id = 'generated-images');
```

### Step 4: Create Update Policy
Create a policy for updating image metadata:

**Policy Name**: `Allow users to update own images`
```sql
CREATE POLICY "Allow users to update own images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'generated-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

## 3. Update Database Schema

Run the updated schema that includes storage fields:

```sql
-- Run this in your Supabase SQL Editor
-- File: supabase-schema-with-storage.sql
```

The schema now includes:
- `storage_path`: Path to the image in Supabase Storage
- `public_url`: Public URL for accessing the image

## 4. Test Storage Setup

### Step 1: Test Image Generation
1. Generate an image using your API
2. Check the server logs for storage upload messages
3. Verify the image appears in your Supabase Storage bucket

### Step 2: Verify Public URLs
1. Check the `image_generations` table
2. Verify `storage_path` and `public_url` fields are populated
3. Test accessing the image via the public URL

## 5. Storage Structure

Images will be stored with this structure:
```
generated-images/
├── images/
│   ├── user-id-1/
│   │   ├── 600x400_2025-09-25T23-00-00-000Z.jpg
│   │   └── 800x600_2025-09-25T23-05-00-000Z.jpg
│   └── user-id-2/
│       └── 1024x768_2025-09-25T23-10-00-000Z.jpg
```

## 6. Benefits of Supabase Storage

### ✅ **Permanent Storage**
- Images are saved permanently
- No data loss on server restart
- Reliable cloud storage

### ✅ **Public URLs**
- Direct access to images
- CDN delivery for fast loading
- No server bandwidth usage

### ✅ **User Organization**
- Images organized by user ID
- Easy to manage and clean up
- Scalable storage solution

### ✅ **Cost Effective**
- Pay only for storage used
- No server storage limitations
- Built-in CDN and optimization

## 7. Monitoring and Management

### Storage Usage
- Monitor storage usage in Supabase dashboard
- Set up alerts for storage limits
- Clean up old images if needed

### Performance
- Images are served via Supabase CDN
- Fast global delivery
- Automatic optimization

## 8. Troubleshooting

### Common Issues

#### Images not uploading
- Check bucket permissions
- Verify storage policies
- Check file size limits

#### Public URLs not working
- Ensure bucket is set to public
- Check storage policies
- Verify file paths

#### Storage quota exceeded
- Monitor usage in dashboard
- Clean up old images
- Upgrade storage plan if needed

## 9. Environment Variables

Make sure these are set in your `.env` file:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 10. Next Steps

After setup:
1. Generate a test image
2. Verify it appears in storage
3. Check the public URL works
4. Monitor storage usage
5. Set up cleanup policies if needed

Your AI images will now be permanently stored in Supabase Storage with public URLs for easy access! 🎉
