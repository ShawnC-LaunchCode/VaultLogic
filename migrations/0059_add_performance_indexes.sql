-- Migration: Add performance indexes for analytics and logging
-- Created: 2025-12-25
-- Purpose: Optimize time-based queries and reporting
--
-- This migration adds indexes for common analytics and audit queries that
-- filter or sort by timestamp fields.

-- ============================================================================
-- WORKFLOW RUNS - Analytics & Reporting
-- ============================================================================

-- Index for completed runs sorted by completion time
-- Used in: analytics dashboards, completion rate reports, trend analysis
CREATE INDEX IF NOT EXISTS idx_workflow_runs_completed_at
ON workflow_runs(completed_at DESC)
WHERE completed_at IS NOT NULL;

COMMENT ON INDEX idx_workflow_runs_completed_at IS
'Partial index for completed workflow runs ordered by completion time. Excludes in-progress runs (NULL completed_at).';

-- Index for workflow-specific analytics queries
-- Used in: per-workflow analytics, funnel analysis, dropoff tracking
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_completed
ON workflow_runs(workflow_id, completed_at DESC)
WHERE completed_at IS NOT NULL;

COMMENT ON INDEX idx_workflow_runs_workflow_completed IS
'Composite index for workflow-scoped analytics queries with time ordering.';

-- Index for filtering runs by status and completion
-- Used in: run dashboards, progress tracking, abandoned run cleanup
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status
ON workflow_runs(status, created_at DESC);

COMMENT ON INDEX idx_workflow_runs_status IS
'Index for filtering runs by status (draft/in_progress/completed) with creation time ordering.';

-- ============================================================================
-- AUDIT LOGS - Security & Compliance
-- ============================================================================

-- Index for time-based audit log queries
-- Used in: audit log viewer, security investigations, compliance reports
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp
ON audit_logs(timestamp DESC);

COMMENT ON INDEX idx_audit_logs_timestamp IS
'Index for audit logs ordered by timestamp. Essential for log viewer pagination and time-range queries.';

-- Index for user-specific audit trails
-- Used in: user activity reports, security audits, debugging
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp
ON audit_logs(user_id, timestamp DESC)
WHERE user_id IS NOT NULL;

COMMENT ON INDEX idx_audit_logs_user_timestamp IS
'Composite index for user-scoped audit trails. Partial index excludes system events (NULL user_id).';

-- Index for resource-specific audit trails
-- Used in: workflow change history, data lineage, compliance
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
ON audit_logs(resource_type, resource_id, timestamp DESC);

COMMENT ON INDEX idx_audit_logs_resource IS
'Composite index for resource-scoped audit trails (e.g., all changes to workflow X).';

-- ============================================================================
-- ANALYTICS EVENTS - Real-time Tracking
-- ============================================================================

-- Index for workflow-specific event queries
-- Used in: real-time analytics, event tracking, funnel analysis
CREATE INDEX IF NOT EXISTS idx_analytics_events_workflow_timestamp
ON analytics_events(workflow_id, timestamp DESC);

COMMENT ON INDEX idx_analytics_events_workflow_timestamp IS
'Composite index for workflow-scoped analytics events with time ordering.';

-- Index for event type aggregation
-- Used in: event type reports, usage metrics, system monitoring
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_timestamp
ON analytics_events(event_type, timestamp DESC);

COMMENT ON INDEX idx_analytics_events_type_timestamp IS
'Composite index for event type aggregation and filtering.';

-- ============================================================================
-- SCRIPT EXECUTION LOGS - Debugging & Performance
-- ============================================================================

-- Index for run-specific script logs
-- Used in: script console, debugging, performance analysis
CREATE INDEX IF NOT EXISTS idx_script_execution_log_run
ON script_execution_log(run_id, created_at DESC)
WHERE run_id IS NOT NULL;

COMMENT ON INDEX idx_script_execution_log_run IS
'Index for retrieving script execution logs for a specific run. Used in script console.';

-- Index for failed script executions
-- Used in: error monitoring, debugging, reliability metrics
CREATE INDEX IF NOT EXISTS idx_script_execution_log_failures
ON script_execution_log(status, created_at DESC)
WHERE status = 'error';

COMMENT ON INDEX idx_script_execution_log_failures IS
'Partial index for failed script executions. Critical for error monitoring and alerting.';

-- Rollback (if needed):
-- DROP INDEX IF EXISTS idx_workflow_runs_completed_at;
-- DROP INDEX IF EXISTS idx_workflow_runs_workflow_completed;
-- DROP INDEX IF EXISTS idx_workflow_runs_status;
-- DROP INDEX IF EXISTS idx_audit_logs_timestamp;
-- DROP INDEX IF EXISTS idx_audit_logs_user_timestamp;
-- DROP INDEX IF EXISTS idx_audit_logs_resource;
-- DROP INDEX IF EXISTS idx_analytics_events_workflow_timestamp;
-- DROP INDEX IF EXISTS idx_analytics_events_type_timestamp;
-- DROP INDEX IF EXISTS idx_script_execution_log_run;
-- DROP INDEX IF EXISTS idx_script_execution_log_failures;
