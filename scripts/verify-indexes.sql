-- Script to verify database indexes added in migrations 0057-0059
-- Run this after applying the migrations to confirm they were created successfully
--
-- Usage:
--   psql $DATABASE_URL -f scripts/verify-indexes.sql

\echo '========================================'
\echo 'VaultLogic Index Verification Script'
\echo 'Created: 2025-12-25'
\echo '========================================'
\echo ''

\echo 'Checking for new indexes from migrations 0057-0059...'
\echo ''

-- ==============================================================================
-- Migration 0057: Step Values Composite Index
-- ==============================================================================
\echo '1. Migration 0057: Step Values Indexes'
\echo '   Expected: idx_step_values_run_step'

SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '   ✓ FOUND: idx_step_values_run_step'
        ELSE '   ✗ MISSING: idx_step_values_run_step'
    END as status
FROM pg_indexes
WHERE tablename = 'step_values'
  AND indexname = 'idx_step_values_run_step';

\echo ''

-- ==============================================================================
-- Migration 0058: Logic Rules Indexes
-- ==============================================================================
\echo '2. Migration 0058: Logic Rules Indexes'
\echo '   Expected: 3 indexes'

SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '   ✓ FOUND: idx_logic_rules_target_step'
        ELSE '   ✗ MISSING: idx_logic_rules_target_step'
    END as status
FROM pg_indexes
WHERE tablename = 'logic_rules'
  AND indexname = 'idx_logic_rules_target_step';

SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '   ✓ FOUND: idx_logic_rules_target_section'
        ELSE '   ✗ MISSING: idx_logic_rules_target_section'
    END as status
FROM pg_indexes
WHERE tablename = 'logic_rules'
  AND indexname = 'idx_logic_rules_target_section';

SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '   ✓ FOUND: idx_logic_rules_workflow'
        ELSE '   ✗ MISSING: idx_logic_rules_workflow'
    END as status
FROM pg_indexes
WHERE tablename = 'logic_rules'
  AND indexname = 'idx_logic_rules_workflow';

\echo ''

-- ==============================================================================
-- Migration 0059: Performance Indexes
-- ==============================================================================
\echo '3. Migration 0059: Performance Indexes'
\echo '   Expected: 10 indexes across 4 tables'
\echo ''

\echo '   Workflow Runs Indexes:'
SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '   ✓ FOUND: idx_workflow_runs_completed_at'
        ELSE '   ✗ MISSING: idx_workflow_runs_completed_at'
    END as status
FROM pg_indexes
WHERE tablename = 'workflow_runs'
  AND indexname = 'idx_workflow_runs_completed_at';

SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '   ✓ FOUND: idx_workflow_runs_workflow_completed'
        ELSE '   ✗ MISSING: idx_workflow_runs_workflow_completed'
    END as status
FROM pg_indexes
WHERE tablename = 'workflow_runs'
  AND indexname = 'idx_workflow_runs_workflow_completed';

SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '   ✓ FOUND: idx_workflow_runs_status'
        ELSE '   ✗ MISSING: idx_workflow_runs_status'
    END as status
FROM pg_indexes
WHERE tablename = 'workflow_runs'
  AND indexname = 'idx_workflow_runs_status';

\echo ''
\echo '   Audit Logs Indexes:'
SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '   ✓ FOUND: idx_audit_logs_timestamp'
        ELSE '   ✗ MISSING: idx_audit_logs_timestamp'
    END as status
FROM pg_indexes
WHERE tablename = 'audit_logs'
  AND indexname = 'idx_audit_logs_timestamp';

SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '   ✓ FOUND: idx_audit_logs_user_timestamp'
        ELSE '   ✗ MISSING: idx_audit_logs_user_timestamp'
    END as status
FROM pg_indexes
WHERE tablename = 'audit_logs'
  AND indexname = 'idx_audit_logs_user_timestamp';

SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '   ✓ FOUND: idx_audit_logs_resource'
        ELSE '   ✗ MISSING: idx_audit_logs_resource'
    END as status
FROM pg_indexes
WHERE tablename = 'audit_logs'
  AND indexname = 'idx_audit_logs_resource';

\echo ''
\echo '   Analytics Events Indexes:'
SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '   ✓ FOUND: idx_analytics_events_workflow_timestamp'
        ELSE '   ✗ MISSING: idx_analytics_events_workflow_timestamp'
    END as status
FROM pg_indexes
WHERE tablename = 'analytics_events'
  AND indexname = 'idx_analytics_events_workflow_timestamp';

SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '   ✓ FOUND: idx_analytics_events_type_timestamp'
        ELSE '   ✗ MISSING: idx_analytics_events_type_timestamp'
    END as status
FROM pg_indexes
WHERE tablename = 'analytics_events'
  AND indexname = 'idx_analytics_events_type_timestamp';

\echo ''
\echo '   Script Execution Log Indexes:'
SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '   ✓ FOUND: idx_script_execution_log_run'
        ELSE '   ✗ MISSING: idx_script_execution_log_run'
    END as status
FROM pg_indexes
WHERE tablename = 'script_execution_log'
  AND indexname = 'idx_script_execution_log_run';

SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '   ✓ FOUND: idx_script_execution_log_failures'
        ELSE '   ✗ MISSING: idx_script_execution_log_failures'
    END as status
FROM pg_indexes
WHERE tablename = 'script_execution_log'
  AND indexname = 'idx_script_execution_log_failures';

\echo ''
\echo '========================================'
\echo 'Summary: Index Details'
\echo '========================================'
\echo ''

-- Show all new indexes with their definitions
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexname IN (
    'idx_step_values_run_step',
    'idx_logic_rules_target_step',
    'idx_logic_rules_target_section',
    'idx_logic_rules_workflow',
    'idx_workflow_runs_completed_at',
    'idx_workflow_runs_workflow_completed',
    'idx_workflow_runs_status',
    'idx_audit_logs_timestamp',
    'idx_audit_logs_user_timestamp',
    'idx_audit_logs_resource',
    'idx_analytics_events_workflow_timestamp',
    'idx_analytics_events_type_timestamp',
    'idx_script_execution_log_run',
    'idx_script_execution_log_failures'
)
ORDER BY tablename, indexname;

\echo ''
\echo '========================================'
\echo 'Summary: Index Sizes'
\echo '========================================'
\echo ''

-- Show index sizes
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE indexname IN (
    'idx_step_values_run_step',
    'idx_logic_rules_target_step',
    'idx_logic_rules_target_section',
    'idx_logic_rules_workflow',
    'idx_workflow_runs_completed_at',
    'idx_workflow_runs_workflow_completed',
    'idx_workflow_runs_status',
    'idx_audit_logs_timestamp',
    'idx_audit_logs_user_timestamp',
    'idx_audit_logs_resource',
    'idx_analytics_events_workflow_timestamp',
    'idx_analytics_events_type_timestamp',
    'idx_script_execution_log_run',
    'idx_script_execution_log_failures'
)
ORDER BY pg_relation_size(indexname::regclass) DESC;

\echo ''
\echo 'Verification complete!'
\echo ''
