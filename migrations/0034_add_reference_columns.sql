-- Add 'reference' type to datavault_column_type enum
-- Note: PostgreSQL doesn't support ALTER TYPE ... ADD VALUE in transactions,
-- so this must be run separately if in a transaction block
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'reference'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'datavault_column_type')
  ) THEN
    ALTER TYPE datavault_column_type ADD VALUE 'reference';
  END IF;
END $$;

-- Add reference columns to datavault_columns table
ALTER TABLE datavault_columns
ADD COLUMN IF NOT EXISTS reference_table_id UUID,
ADD COLUMN IF NOT EXISTS reference_display_column_slug TEXT;

-- Add index for reference_table_id for performance
CREATE INDEX IF NOT EXISTS datavault_columns_reference_table_idx
ON datavault_columns(reference_table_id);

-- Comments for documentation
COMMENT ON COLUMN datavault_columns.reference_table_id IS 'Reference to another datavault table (for reference type columns)';
COMMENT ON COLUMN datavault_columns.reference_display_column_slug IS 'Slug of column to display from referenced table';
