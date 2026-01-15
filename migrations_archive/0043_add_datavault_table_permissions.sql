-- Migration: Add DataVault Table Permissions (v4 Micro-Phase 6)
-- Description: Add per-table RBAC with owner/write/read roles
-- Author: VaultLogic Team
-- Date: 2025-11-20

-- Create table permissions role enum
CREATE TYPE datavault_table_role AS ENUM ('owner', 'write', 'read');

-- Create table permissions table
CREATE TABLE datavault_table_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES datavault_tables(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role datavault_table_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one permission per user per table
  CONSTRAINT unique_table_user_permission UNIQUE (table_id, user_id)
);

-- Create indices for efficient permission lookups
CREATE INDEX idx_table_permissions_table ON datavault_table_permissions(table_id);
CREATE INDEX idx_table_permissions_user ON datavault_table_permissions(user_id);
CREATE INDEX idx_table_permissions_role ON datavault_table_permissions(table_id, role);

-- Add comment
COMMENT ON TABLE datavault_table_permissions IS 'Per-table permissions for DataVault tables with owner/write/read roles';
COMMENT ON COLUMN datavault_table_permissions.role IS 'owner: full control, write: read+write data, read: read-only';
