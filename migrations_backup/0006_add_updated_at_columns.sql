-- Migration: Add updated_at columns to workflows and projects
-- This migration adds the missing updated_at timestamp columns that are being queried in the codebase

-- Add updated_at to workflows table
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

-- Add updated_at to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

-- Backfill existing records with created_at value as the initial updated_at
UPDATE workflows SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE projects SET updated_at = created_at WHERE updated_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN workflows.updated_at IS 'Timestamp of last workflow update';
COMMENT ON COLUMN projects.updated_at IS 'Timestamp of last project update';

-- Create indices for faster queries on updated_at
CREATE INDEX IF NOT EXISTS workflows_updated_at_idx ON workflows(updated_at);
CREATE INDEX IF NOT EXISTS projects_updated_at_idx ON projects(updated_at);
