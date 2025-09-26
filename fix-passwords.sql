-- Fix existing users by adding default passwords
-- Run this in your Supabase SQL Editor

-- First, create the password reset tokens table if it doesn't exist
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    email TEXT PRIMARY KEY,
    token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update demo user with specific password (demo123)
UPDATE users 
SET password = '$2b$10$MAfNUKuqef50C9xU82h/3OfBUHKXAEypEL6l4KAAqYjP0OMLO7HI6'
WHERE email = 'demo@example.com';

-- Update all other users with null passwords (default password: 'password')
UPDATE users 
SET password = '$2b$10$JWq9i7amWj39QD3DpOoOwOLHAmO5ORnoZOAuok23ntBVWpRRvelse'
WHERE password IS NULL;

-- Check the results
SELECT id, email, name, password IS NOT NULL as has_password, email_verified, credits 
FROM users;
