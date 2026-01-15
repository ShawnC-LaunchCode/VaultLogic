-- Migration: Add js_question to step_type enum
-- This enables JavaScript questions as a first-class question type

-- Add js_question to the step_type enum
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'js_question';
