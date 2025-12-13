-- Migration 0051: Add version_hash column to workflow_snapshots
-- This column stores a hash of the workflow structure at snapshot creation time
-- to detect when snapshots become outdated due to workflow changes

ALTER TABLE workflow_snapshots
  ADD COLUMN version_hash TEXT;

-- Index for faster lookups when checking hash validity
CREATE INDEX idx_workflow_snapshots_version_hash ON workflow_snapshots(version_hash);

-- Comment on the new column
COMMENT ON COLUMN workflow_snapshots.version_hash IS 'Hash of workflow structure (steps + aliases + types) at snapshot creation';
