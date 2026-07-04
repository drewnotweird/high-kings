-- Add avatar config column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar jsonb;
