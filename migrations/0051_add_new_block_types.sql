-- Migration: Add New Block Types to step_type Enum
-- Version: 2.0.0 - Block System Overhaul
-- Date: December 2025
-- Description: Extends step_type enum with all new Easy Mode and Advanced Mode block types

-- Add new step types to the step_type enum
-- Note: PostgreSQL requires dropping and recreating the enum when adding values
-- We use ALTER TYPE ... ADD VALUE which is safer and doesn't require table locks

-- ===== EASY MODE TYPES =====

-- True/False toggle
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'true_false';

-- Phone number input
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'phone';

-- Date-only picker
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'date';

-- Time-only picker
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'time';

-- Combined date and time
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'datetime';

-- Email input
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'email';

-- Number input
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'number';

-- Currency input
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'currency';

-- Scale/rating
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'scale';

-- Website/URL input
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'website';

-- Display-only content
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'display';

-- US address input
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'address';

-- ===== ADVANCED MODE TYPES =====

-- Unified text input
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'text';

-- Boolean with custom labels
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'boolean';

-- Advanced phone with international support
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'phone_advanced';

-- Unified date/time picker
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'datetime_unified';

-- Unified choice (radio/dropdown/multiple)
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'choice';

-- Advanced email
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'email_advanced';

-- Advanced number with currency
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'number_advanced';

-- Advanced scale with custom styling
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'scale_advanced';

-- Advanced URL validation
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'website_advanced';

-- Advanced address with international support
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'address_advanced';

-- Multi-field groups (name, contact, date ranges)
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'multi_field';

-- Advanced display with rich formatting
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'display_advanced';

-- Migration complete
-- No existing data affected - new types are purely additive
-- Existing workflows continue to use their current step types
