-- Migration 0035: Add PostgreSQL sequences for auto-number columns
-- Fixes race condition where concurrent inserts could generate duplicate auto-numbers
-- Before: Used MAX(value) + 1 (race condition possible)
-- After: Use database sequences (atomic, guaranteed unique)

-- Step 1: Create a function to get or create a sequence for an auto-number column
CREATE OR REPLACE FUNCTION datavault_get_next_auto_number(
  p_table_id UUID,
  p_column_id UUID,
  p_start_value INTEGER DEFAULT 1
) RETURNS INTEGER AS $$
DECLARE
  v_sequence_name TEXT;
  v_next_val INTEGER;
  v_max_existing INTEGER;
BEGIN
  -- Generate sequence name (Postgres identifier limit is 63 chars)
  v_sequence_name := 'datavault_seq_' || REPLACE(p_column_id::TEXT, '-', '_');

  -- Check if sequence exists, create if not
  IF NOT EXISTS (
    SELECT 1 FROM pg_sequences
    WHERE schemaname = 'public' AND sequencename = v_sequence_name
  ) THEN
    -- Get max existing value for this column to avoid conflicts
    SELECT COALESCE(MAX((value->>0)::INTEGER), p_start_value - 1)
    INTO v_max_existing
    FROM datavault_values
    WHERE column_id = p_column_id
      AND jsonb_typeof(value) = 'number';

    -- Create sequence starting from max + 1
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START WITH %s',
                   v_sequence_name,
                   GREATEST(v_max_existing + 1, p_start_value));
  END IF;

  -- Get next value from sequence
  EXECUTE format('SELECT nextval(%L)', v_sequence_name) INTO v_next_val;

  RETURN v_next_val;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create helper function to cleanup sequences when columns are deleted
CREATE OR REPLACE FUNCTION datavault_cleanup_sequence(p_column_id UUID) RETURNS VOID AS $$
DECLARE
  v_sequence_name TEXT;
BEGIN
  v_sequence_name := 'datavault_seq_' || REPLACE(p_column_id::TEXT, '-', '_');

  -- Drop sequence if it exists
  EXECUTE format('DROP SEQUENCE IF EXISTS %I', v_sequence_name);
END;
$$ LANGUAGE plpgsql;

-- Step 3: Add comment for documentation
COMMENT ON FUNCTION datavault_get_next_auto_number IS
'Atomically generates the next auto-number value for a DataVault column using PostgreSQL sequences. Fixes race condition in concurrent row creation.';

COMMENT ON FUNCTION datavault_cleanup_sequence IS
'Cleans up the PostgreSQL sequence when an auto-number column is deleted.';
