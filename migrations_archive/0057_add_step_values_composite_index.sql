-- Migration: Add composite index on step_values table
-- Created: 2025-12-25
-- Purpose: Optimize queries that fetch step values for a specific run
--
-- This index significantly improves performance for:
-- 1. Loading all step values for a workflow run (most common query)
-- 2. Checking if a specific step has been answered in a run
-- 3. Run completion validation (checking all required steps)
--
-- Query pattern: SELECT * FROM step_values WHERE run_id = ? AND step_id = ?
-- Expected improvement: O(log n) instead of O(n) for lookups

CREATE INDEX IF NOT EXISTS idx_step_values_run_step
ON step_values(run_id, step_id);

-- Add comment to document the index purpose
COMMENT ON INDEX idx_step_values_run_step IS
'Composite index for efficient lookup of step values by run and step. Critical for workflow execution performance.';

-- Rollback (if needed):
-- DROP INDEX IF EXISTS idx_step_values_run_step;
