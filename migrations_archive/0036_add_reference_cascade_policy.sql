-- Migration 0036: Add cascade policy for reference column deletions
-- Fixes dangling references when referenced rows are deleted
-- Policy: SET NULL (preserves row but clears invalid reference)

-- Step 1: Add trigger function to handle reference value cleanup
CREATE OR REPLACE FUNCTION datavault_cleanup_references_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- When a row is deleted, set all reference values pointing to it to NULL
  UPDATE datavault_values
  SET value = 'null'::jsonb,
      updated_at = NOW()
  WHERE value = to_jsonb(OLD.id::TEXT)
    AND column_id IN (
      SELECT id FROM datavault_columns
      WHERE type = 'reference'
        AND reference_table_id = OLD.table_id
    );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create trigger on datavault_rows table
DROP TRIGGER IF EXISTS trigger_cleanup_references_on_delete ON datavault_rows;

CREATE TRIGGER trigger_cleanup_references_on_delete
  BEFORE DELETE ON datavault_rows
  FOR EACH ROW
  EXECUTE FUNCTION datavault_cleanup_references_on_delete();

-- Step 3: Add helper function to check if row is referenced
CREATE OR REPLACE FUNCTION datavault_is_row_referenced(p_row_id UUID)
RETURNS TABLE(
  referencing_table_id UUID,
  referencing_column_id UUID,
  reference_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.table_id AS referencing_table_id,
    c.id AS referencing_column_id,
    COUNT(*) AS reference_count
  FROM datavault_columns c
  INNER JOIN datavault_values v ON v.column_id = c.id
  WHERE c.type = 'reference'
    AND v.value = to_jsonb(p_row_id::TEXT)
  GROUP BY c.table_id, c.id;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Add comments for documentation
COMMENT ON FUNCTION datavault_cleanup_references_on_delete IS
'Automatically sets reference column values to NULL when the referenced row is deleted. Prevents dangling references.';

COMMENT ON FUNCTION datavault_is_row_referenced IS
'Checks if a row is referenced by other rows in reference columns. Returns list of referencing tables/columns with counts.';

COMMENT ON TRIGGER trigger_cleanup_references_on_delete ON datavault_rows IS
'Automatically cleans up dangling references when rows are deleted by setting reference values to NULL.';
