-- Migration: Add Performance-Critical Indexes
-- Date: 2025-12-24
-- Purpose: Fix N+1 queries and improve query performance
-- Issue: Missing composite indexes causing full table scans

-- ============================================================================
-- CRITICAL: Composite index for step_values (runId, stepId)
-- ============================================================================
-- Current issue: Queries using WHERE run_id = ? AND step_id = ? require full table scan
-- Impact: Every step value upsert performs 2-3 queries with table scan
-- Fix: Composite index enables O(1) lookup instead of O(n) scan

CREATE INDEX IF NOT EXISTS step_values_run_step_idx
ON step_values(run_id, step_id);

-- ============================================================================
-- CRITICAL: Foreign key indexes for logic_rules
-- ============================================================================
-- Current issue: Filtering by target_step_id and target_section_id causes full scans
-- Impact: Logic evaluation scans entire logic_rules table for each step/section
-- Fix: Indexes on foreign keys enable efficient filtering

CREATE INDEX IF NOT EXISTS logic_rules_target_step_idx
ON logic_rules(target_step_id)
WHERE target_step_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS logic_rules_target_section_idx
ON logic_rules(target_section_id)
WHERE target_section_id IS NOT NULL;

-- ============================================================================
-- OPTIMIZATION: Add index for workflow runs by status
-- ============================================================================
-- Useful for filtering completed/in-progress runs

CREATE INDEX IF NOT EXISTS workflow_runs_status_idx
ON workflow_runs(status)
WHERE status IS NOT NULL;

-- ============================================================================
-- OPTIMIZATION: Add index for workflow runs by completion date
-- ============================================================================
-- Useful for analytics queries and date-range filtering

CREATE INDEX IF NOT EXISTS workflow_runs_completed_at_idx
ON workflow_runs(completed_at)
WHERE completed_at IS NOT NULL;

-- ============================================================================
-- Verify indexes were created
-- ============================================================================
-- Run this query after migration to verify:
-- SELECT schemaname, tablename, indexname
-- FROM pg_indexes
-- WHERE tablename IN ('step_values', 'logic_rules', 'workflow_runs')
-- ORDER BY tablename, indexname;
