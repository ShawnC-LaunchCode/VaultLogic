-- Migration: Add Virtual Steps Support for Transform Blocks
-- Date: 2025-11-11
-- Description: This migration adds support for virtual steps that store transform block outputs.
--              Virtual steps are hidden from the UI but allow transform blocks to persist their
--              computed values as proper step values with UUIDs.

-- Step 1: Add 'computed' type to step_type enum
-- This allows us to mark virtual steps with a distinct type
ALTER TYPE "step_type" ADD VALUE IF NOT EXISTS 'computed';

-- Step 2: Add new columns to steps table
-- isVirtual: Flag to easily filter virtual steps from UI queries
ALTER TABLE "steps" ADD COLUMN IF NOT EXISTS "is_virtual" boolean DEFAULT false NOT NULL;

-- Add index for efficient querying of non-virtual steps
CREATE INDEX IF NOT EXISTS "steps_is_virtual_idx" ON "steps" ("is_virtual");

-- Step 3: Add virtual_step_id column to transform_blocks table
-- This links each transform block to its virtual step
ALTER TABLE "transform_blocks" ADD COLUMN IF NOT EXISTS "virtual_step_id" uuid REFERENCES "steps"("id") ON DELETE SET NULL;

-- Add index for efficient lookup
CREATE INDEX IF NOT EXISTS "transform_blocks_virtual_step_idx" ON "transform_blocks" ("virtual_step_id");

-- Step 4: Comment on new columns for documentation
COMMENT ON COLUMN "steps"."is_virtual" IS 'Marks virtual steps created by transform blocks. Virtual steps are hidden from UI but store computed values.';
COMMENT ON COLUMN "transform_blocks"."virtual_step_id" IS 'Links transform block to its virtual step. The virtual step stores the blocks output value.';

-- Note: Data migration to create virtual steps for existing transform blocks
-- should be run separately using the data migration script.
