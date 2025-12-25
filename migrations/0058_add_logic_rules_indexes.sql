-- Migration: Add foreign key indexes on logic_rules table
-- Created: 2025-12-25
-- Purpose: Optimize logic rule evaluation and visibility calculations
--
-- Background:
-- When evaluating conditional logic, we frequently need to:
-- 1. Find all logic rules that target a specific step (for visibility)
-- 2. Find all logic rules that target a specific section (for skip logic)
--
-- Without these indexes, PostgreSQL performs sequential scans on the entire
-- logic_rules table for every step/section visibility check.
--
-- Performance impact:
-- - Workflow with 50 steps, 20 logic rules
-- - Without index: 20 full table scans per page load
-- - With index: 20 O(log n) lookups

-- Index for finding logic rules targeting a specific step
-- Used in: visibility calculations, step validation, UI rendering
CREATE INDEX IF NOT EXISTS idx_logic_rules_target_step
ON logic_rules(target_step_id)
WHERE target_step_id IS NOT NULL;

COMMENT ON INDEX idx_logic_rules_target_step IS
'Partial index for finding logic rules that target a specific step. Includes WHERE clause to exclude NULL values.';

-- Index for finding logic rules targeting a specific section
-- Used in: section skip logic, navigation, progress tracking
CREATE INDEX IF NOT EXISTS idx_logic_rules_target_section
ON logic_rules(target_section_id)
WHERE target_section_id IS NOT NULL;

COMMENT ON INDEX idx_logic_rules_target_section IS
'Partial index for finding logic rules that target a specific section. Includes WHERE clause to exclude NULL values.';

-- Additional index for workflow-scoped queries
-- Used in: logic rule management, workflow cloning, export
CREATE INDEX IF NOT EXISTS idx_logic_rules_workflow
ON logic_rules(workflow_id);

COMMENT ON INDEX idx_logic_rules_workflow IS
'Index for retrieving all logic rules for a workflow. Used in builder UI and workflow operations.';

-- Rollback (if needed):
-- DROP INDEX IF EXISTS idx_logic_rules_target_step;
-- DROP INDEX IF EXISTS idx_logic_rules_target_section;
-- DROP INDEX IF EXISTS idx_logic_rules_workflow;
