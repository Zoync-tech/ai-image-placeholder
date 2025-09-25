-- Supabase Database Reset Script
-- Run this to drop all existing tables and recreate them with the correct schema

-- Drop existing tables in correct order (due to foreign key constraints)
DROP TABLE IF EXISTS image_generations CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS email_verifications CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS deduct_credit(UUID, INTEGER);
DROP FUNCTION IF EXISTS cleanup_expired_sessions();
DROP FUNCTION IF EXISTS cleanup_expired_verifications();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Now run the main schema file: supabase-schema.sql
-- This script just cleans up existing data before applying the new schema
