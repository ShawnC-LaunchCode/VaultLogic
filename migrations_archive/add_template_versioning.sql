-- Migration: Add Template Versioning System
-- Created: 2025-12-22
-- Description: Add version tracking for document templates to support:
--   - Version history and audit trail
--   - Ability to revert to previous versions
--   - Snapshot of template files, metadata, and mappings at each version
--   - Track who made changes and when

-- Create template_versions table
CREATE TABLE IF NOT EXISTS template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_ref VARCHAR(500) NOT NULL,  -- Snapshot of file at this version
  metadata JSONB DEFAULT '{}'::jsonb,  -- Snapshot of metadata (fields, pages, etc.)
  mapping JSONB DEFAULT '{}'::jsonb,   -- Snapshot of field mapping
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,  -- Optional notes about what changed in this version
  is_active BOOLEAN DEFAULT true,  -- Mark deprecated versions as inactive

  -- Ensure version numbers are unique per template
  UNIQUE(template_id, version_number)
);

-- Create indices for performance
CREATE INDEX template_versions_template_idx ON template_versions(template_id);
CREATE INDEX template_versions_created_at_idx ON template_versions(created_at DESC);
CREATE INDEX template_versions_created_by_idx ON template_versions(created_by);

-- Add version tracking to templates table
ALTER TABLE templates ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create template_generation_metrics table for analytics
CREATE TABLE IF NOT EXISTS template_generation_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  run_id UUID REFERENCES workflow_runs(id) ON DELETE CASCADE,
  result VARCHAR(50) NOT NULL CHECK (result IN ('success', 'failure', 'skipped')),
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indices for metrics
CREATE INDEX template_metrics_template_idx ON template_generation_metrics(template_id);
CREATE INDEX template_metrics_run_idx ON template_generation_metrics(run_id);
CREATE INDEX template_metrics_result_idx ON template_generation_metrics(result);
CREATE INDEX template_metrics_created_at_idx ON template_generation_metrics(created_at DESC);

-- Create function to auto-create version on template update
CREATE OR REPLACE FUNCTION create_template_version_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create version if file_ref, metadata, or mapping changed
  IF (OLD.file_ref IS DISTINCT FROM NEW.file_ref) OR
     (OLD.metadata IS DISTINCT FROM NEW.metadata) OR
     (OLD.mapping IS DISTINCT FROM NEW.mapping) THEN

    -- Increment version number
    NEW.current_version := COALESCE(NEW.current_version, 0) + 1;

    -- Create version record
    INSERT INTO template_versions (
      template_id,
      version_number,
      file_ref,
      metadata,
      mapping,
      created_by,
      notes
    ) VALUES (
      NEW.id,
      NEW.current_version,
      NEW.file_ref,
      NEW.metadata,
      NEW.mapping,
      NEW.last_modified_by,
      'Auto-saved version'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic versioning
DROP TRIGGER IF EXISTS template_version_trigger ON templates;
CREATE TRIGGER template_version_trigger
  BEFORE UPDATE ON templates
  FOR EACH ROW
  EXECUTE FUNCTION create_template_version_on_update();

-- Backfill: Create initial versions for existing templates
INSERT INTO template_versions (
  template_id,
  version_number,
  file_ref,
  metadata,
  mapping,
  created_at,
  notes
)
SELECT
  id,
  1,
  file_ref,
  metadata,
  mapping,
  created_at,
  'Initial version (backfilled)'
FROM templates
WHERE id NOT IN (SELECT DISTINCT template_id FROM template_versions);

-- Update current_version for templates that don't have it set
UPDATE templates
SET current_version = 1
WHERE current_version IS NULL;

COMMENT ON TABLE template_versions IS 'Version history for document templates - enables rollback and audit trail';
COMMENT ON TABLE template_generation_metrics IS 'Metrics tracking for document generation - used for analytics and monitoring';
COMMENT ON COLUMN templates.current_version IS 'Current version number of the template';
COMMENT ON COLUMN templates.last_modified_by IS 'User who last modified the template';
