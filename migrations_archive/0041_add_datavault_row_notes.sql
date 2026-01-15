-- Migration 0041: Add DataVault Row Notes (DataVault v4 Micro-Phase 3)
-- Description: Add row-level notes/comments independent of table columns
-- Date: November 20, 2025

-- =====================================================================
-- STEP 1: CREATE datavault_row_notes TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS "datavault_row_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "row_id" uuid NOT NULL REFERENCES "datavault_rows"("id") ON DELETE CASCADE,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "text" text NOT NULL,
  "created_at" timestamptz DEFAULT now()
);

-- =====================================================================
-- STEP 2: ADD INDEXES FOR PERFORMANCE
-- =====================================================================

-- Index for fetching notes by row (most common query)
CREATE INDEX IF NOT EXISTS "idx_datavault_row_notes_row_id" ON "datavault_row_notes"("row_id");

-- Index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS "idx_datavault_row_notes_tenant_id" ON "datavault_row_notes"("tenant_id");

-- Index for user's notes lookup
CREATE INDEX IF NOT EXISTS "idx_datavault_row_notes_user_id" ON "datavault_row_notes"("user_id");

-- Composite index for efficient ordering by creation time per row
CREATE INDEX IF NOT EXISTS "idx_datavault_row_notes_row_created" ON "datavault_row_notes"("row_id", "created_at" DESC);

-- =====================================================================
-- STEP 3: ADD COMMENTS FOR DOCUMENTATION
-- =====================================================================

COMMENT ON TABLE "datavault_row_notes" IS
'Stores row-level notes/comments for DataVault rows. Notes are independent of table columns and provide collaboration/audit trail functionality.';

COMMENT ON COLUMN "datavault_row_notes"."row_id" IS
'Reference to the datavault_rows table. Cascade deletes when row is deleted.';

COMMENT ON COLUMN "datavault_row_notes"."tenant_id" IS
'Tenant ID for multi-tenant isolation. Must match the tenant of the referenced row.';

COMMENT ON COLUMN "datavault_row_notes"."user_id" IS
'User who created the note. Used for ownership checks (only creator or table owner can delete).';

COMMENT ON COLUMN "datavault_row_notes"."text" IS
'Note content. Should be sanitized on input to prevent XSS attacks.';

COMMENT ON COLUMN "datavault_row_notes"."created_at" IS
'Timestamp when note was created. Notes are immutable (no updates).';

-- =====================================================================
-- MIGRATION COMPLETE
-- =====================================================================

-- Migration complete. Row notes now support:
-- 1. Multi-tenant isolation
-- 2. Automatic cascade deletion when row is deleted
-- 3. Ownership tracking for delete permissions
-- 4. Efficient queries with proper indexing
-- 5. Ordered by creation time (DESC) for newest-first display
