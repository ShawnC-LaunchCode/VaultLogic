-- Add missing default_mode column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_mode TEXT DEFAULT 'easy' NOT NULL;
